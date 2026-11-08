const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 7.5e5 / 8 });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  const t0 = Date.now(); await pg.goto('http://127.0.0.1:8766/star-core-journey.html', { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => !!document.getElementById('hero-gl'), null, { timeout: 120000 }); const tHero = (Date.now() - t0) / 1000;
  await pg.tap('#play'); const label = await pg.evaluate(() => document.getElementById('play').textContent);
  await pg.waitForFunction(() => !document.getElementById('player').hidden, null, { timeout: 300000 }); const tPlay = (Date.now() - t0) / 1000;
  await pg.waitForTimeout(4000); const y = await pg.evaluate(() => scrollY);
  console.log(JSON.stringify({ slow3G_opening_shot_s: tHero, label_while_loading: label, playing_from_s: tPlay, scrolled_after_4s: y, hero_canvas_gone: await pg.evaluate(() => !document.getElementById('hero-gl')), errs }));
  await b.close();
})();
