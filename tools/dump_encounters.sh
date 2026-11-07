#!/bin/bash
# Build real encounters headless (space encounter test / station) and /wgdump each one, plus an Overworld patch. Usage: dump_encounters.sh -f <any spec file>; SYS=<system id> picks the system.
# Take wgdumps out of a real dedicated server and bake them into viewers, in one command.
#
# WHY A DRIVER AT ALL. `/wgdump` needs a running server, and the sandbox reaps detached processes
# between Bash calls -- so every dump has to be a single command that boots the server, waits for it,
# types into it, waits for the file, and stops it. Doing that by hand with `sleep` guesses is how the
# repo's earlier rigs wasted runs: a boot that took ten seconds longer than the guess produced a
# server that had never seen the command, and a log that said nothing was wrong.
#
# ⚠️ SO NOTHING HERE SLEEPS FOR A FIXED TIME. Every step waits for a LINE IN THE LOG -- "Done (" for the
# boot, "Created generated planet" for the dimension, "WGDUMP " for the file -- with a timeout that
# fails loudly. A dump of a fresh 128x128 footprint generates 64 chunks and can take a minute; a guess
# that covered it would make every small dump take a minute too.
#
# Usage:
#   scripts/dump_world.sh <dimension> <wgdump args...>       one dump
#   scripts/dump_world.sh -f <specfile>                      many, one per line, ONE server boot
#
#   .../dump_world.sh starcore:frontier/3_7/2 column planet 96 96
#   .../dump_world.sh starcore:frontier/-12_44/1 box caves 128 96 128 0 -32 0
#   .../dump_world.sh minecraft:overworld here spawn 64 64 64
#
# ⚠️ USE -f WHENEVER MORE THAN ONE WORLD IS IN QUESTION. Boot and world-load cost about a minute and
# are paid once per invocation, not per dump -- and comparing planets is the normal case, because a
# single world's numbers say nothing about whether a worldgen constant is right. A spec file is one
# `<dimension> <wgdump args...>` per line; blank lines and `#` comments are skipped.
#
# Writes run/wgdump/<name>.json and /tmp/<name>.html for each, and prints both.
set -uo pipefail
cd "${STARCORE:-../starcore}"
SKILL=.claude/skills/minecraft-worldgen-view
LOG=/tmp/wgdump_server.log

SPECS=()
if [ "${1:-}" = "-f" ]; then
	[ -f "${2:-}" ] || { echo "!! no spec file ${2:-}"; exit 2; }
	while IFS= read -r line; do
		case "$line" in ""|\#*) continue;; esac
		SPECS+=("$line")
	done < "$2"
elif [ $# -ge 2 ]; then
	SPECS+=("$*")
else
	sed -n '2,28p' "$0"
	exit 2
fi

./gradlew build -q --offline 2>&1 | grep -v "^Picked up" | head -20

# ⚠️ A dedicated server PAUSES after 60 seconds with no players, and a dump rig has no players by
# construction. `run/` is gitignored, so a fresh checkout gets the default 60 back and this has to be
# written every time rather than once.
mkdir -p run
touch run/server.properties
grep -q "^pause-when-empty-seconds=0" run/server.properties \
	|| { sed -i "/^pause-when-empty-seconds=/d" run/server.properties;
	     echo "pause-when-empty-seconds=0" >> run/server.properties; }

FIFO=$(mktemp -u /tmp/wgdump_fifo.XXXX)
mkfifo "$FIFO"
rm -f "$LOG"
./gradlew runServer --offline < "$FIFO" > "$LOG" 2>&1 &
SERVER=$!
exec 3> "$FIFO"

# Wait for the Nth occurrence of a pattern, or give up and say what was last happening.
#
# ⚠️ THE COUNT IS WHY THIS IS NOT A `grep -q`. With several dumps in one boot the log already holds the
# previous dump's WGDUMP line, so a plain "is it there" test returns instantly and the script races on
# to bake a file the server has not written yet.
#
# ⚠️ ⚠️ AND `grep -c` MUST NOT BE WRITTEN `$(grep -c … || echo 0)`. grep prints "0" *and* exits 1 when it
# matches nothing, so the fallback appends a second zero and the test sees "0\n0" — "integer expression
# expected", a shell error that `while` treats as false, so every wait returns instantly. Measured:
# that typed all eleven commands of a five-dump run into a server that was still restoring its planets,
# every one of them threw, and the run produced no files while claiming each step had completed "after
# 0s". A wait that fails open is worse than no wait at all.
await() {
	local pattern="$1" want="$2" limit="$3" waited=0 have
	while true; do
		have=$(grep -cE "$pattern" "$LOG" 2>/dev/null)
		[ -n "$have" ] || have=0
		[ "$have" -ge "$want" ] && break
		if ! kill -0 $SERVER 2>/dev/null; then
			echo "!! server exited before '$pattern' x$want"; tail -25 "$LOG"; return 1
		fi
		if [ $waited -ge "$limit" ]; then
			echo "!! timed out after ${limit}s waiting for '$pattern' x$want"; tail -25 "$LOG"; return 1
		fi
		sleep 2; waited=$((waited + 2))
	done
	echo "-- $pattern x$want  (after ${waited}s)"
}

fail() { echo stop >&3 2>/dev/null; wait $SERVER 2>/dev/null; exit 1; }

# ⚠️ "Done (" IS NOT THE END OF THIS MOD'S BOOT. Vanilla prints it and then StarCore restores every
# planet the save has visited — measured at 0.5 s after "Done" for eight planets, which is exactly long
# enough to accept a command and throw on it. Measured: eleven commands sent on "Done" all failed with
# "An unexpected error occurred" and the run produced nothing.
#
# ⚠️ AND THERE IS NO LOG LINE FOR "READY". The obvious candidate — the galactic map layout — is printed
# when something first builds the galaxy, which a plain boot never does, so waiting for it hangs forever
# on exactly the runs that were going to work. So: HANDSHAKE INSTEAD OF A MARKER. Send `list` until the
# server answers it. That proves the thing actually needed — that commands are being executed — rather
# than a line that correlates with it, and because the console queue is ordered, everything sent after
# the answer is processed after it.
await 'Done \(' 1 300 || fail
ready=0
for _ in $(seq 1 40); do
	echo list >&3
	sleep 3
	if grep -q "There are .* of a max of" "$LOG" 2>/dev/null; then ready=1; break; fi
done
[ $ready -eq 1 ] || { echo "!! server never answered /list"; tail -20 "$LOG"; fail; }
echo "-- server answers commands"
echo "gamerule starcore:generate_planets true" >&3; sleep 2


SYS=${SYS:-starcore:frontier/12_-7}
JOBS=("test MINI_PLANET $SYS 13" "test MINI_PLANET $SYS 15 48" "test MINI_CLUSTER $SYS 14" "test ASTEROID_FIELD $SYS 11" "station LAB SAFE $SYS 16" "station FRONTIER SAFE $SYS 19")
for j in "${JOBS[@]}"; do echo "space encounter $j" >&3; done
sleep 4
grep -a "ENC " "$LOG" | sed 's/.*ENC/ENC/'
N=$(grep -ac "ENC queued" "$LOG")
await '\[encounter\] built .* into region' $N 900 || true
await '\[encounter\] lit .* in region' $N 300 || true
for r in 13 15 14 11 16 19; do echo "space encounter scan $r" >&3; done
sleep 6
mkdir -p ${OUT:-/tmp/encounters}
grep -a "ENC built" "$LOG" | sed 's/.*ENC/ENC/' | tee ${OUT:-/tmp/encounters}/built.txt
k=0
while read -r line; do
  r=$(echo "$line" | grep -o 'region=[0-9]*' | cut -d= -f2)
  B=$(echo "$line" | grep -o 'touched=BoundingBox{[^}]*}')
  g() { echo "$B" | grep -o "$1=-\?[0-9]*" | cut -d= -f2; }
  x0=$(g minX); y0=$(g minY); z0=$(g minZ); x1=$(g maxX); y1=$(g maxY); z1=$(g maxZ)
  sx=$((x1-x0+1)); sy=$((y1-y0+1)); sz=$((z1-z0+1))
  while [ $((sx*sy*sz)) -gt 8000000 ]; do sx=$((sx*4/5)); sz=$((sz*4/5)); done
  echo "execute in starcore:space run forceload add $x0 $z0 $x1 $z1" >&3; sleep 3
  k=$((k+1))
  echo "execute in starcore:space run wgdump box enc$r $sx $sy $sz $x0 $y0 $z0" >&3
  await 'WGDUMP ' $k 600 || true
  grep -a "WGDUMP\|cap is" "$LOG" | tail -1
done < ${OUT:-/tmp/encounters}/built.txt
k=$((k+1)); echo 'execute in minecraft:overworld run wgdump column owground 64 64 200 -40' >&3
await 'WGDUMP ' $k 600 || true
echo stop >&3; wait $SERVER
ls -la run/wgdump/enc*.json
