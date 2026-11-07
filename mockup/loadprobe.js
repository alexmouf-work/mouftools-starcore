// node loadprobe.js <url> : phone emulation, 4x CPU throttle; timings of the boot and memory
const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const logs = []; pg.on('console', m => logs.push(m.text().slice(0, 160))); pg.on('pageerror', e => logs.push('ERR ' + e));
  const t0 = Date.now();
  await pg.goto(process.argv[2], { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 120; i++) { const h = await pg.evaluate(() => { const e = document.getElementById('boot'); return e && e.hidden; }); if (h) break; await pg.waitForTimeout(500); }
  console.log('boot hidden after', (Date.now() - t0) / 1000, 's');
  console.log(JSON.stringify(await pg.evaluate(() => ({ heap: performance.memory && Math.round(performance.memory.usedJSHeapSize / 1e6), marks: performance.getEntriesByType('mark').map(m => [m.name, Math.round(m.startTime)]) }))));
  console.log(logs.slice(0, 12).join('\n'));
  await b.close();
})();
