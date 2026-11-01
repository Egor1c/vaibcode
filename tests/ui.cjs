const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');

(async () => {
  const server = spawn(process.execPath, ['scripts/serve.mjs'], { env: { ...process.env, PORT: '4178' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', data => process.stderr.write(data));
  let browser;
  let count = 0;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server did not start')), 10000);
      server.once('exit', code => { clearTimeout(timer); reject(new Error('Server exited: ' + code)); });
      server.stdout.once('data', () => { clearTimeout(timer); resolve(); });
    });
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4178');
    assert.equal(await page.locator('.service-card').count(), 12); count++;
    assert.equal(await page.locator('#choose-service').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('[data-service=youtube]').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-service=netflix]').evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('[data-service=premier]').evaluate(el => el === document.activeElement), true); count++;
    await page.keyboard.press('Enter');
    assert.match(await page.locator('#toast').textContent(), /Предпросмотр/); count++;
    await page.locator('#settings-button').click();
    assert.equal(await page.locator('#settings-dialog').evaluate(el => el.open), true);
    await page.locator('#visible-netflix').uncheck();
    await page.locator('input[aria-label="ID приложения YouTube"]').fill('test.youtube');
    await page.locator('input[aria-label="ID приложения YouTube"]').press('Tab');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#settings-dialog').evaluate(el => el.open), false);
    assert.equal(await page.locator('#settings-button').evaluate(el => el === document.activeElement), true);
    await page.reload();
    assert.equal(await page.locator('[data-service=netflix]').count(), 0);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('livingroom.settings.v1')).youtube.appId), 'test.youtube'); count++;
    await page.evaluate(() => {
      window.PalmServiceBridge = function () {
        this.call = (uri, params) => { window.lastCall = { uri, params: JSON.parse(params) }; this.onservicecallback(JSON.stringify({ returnValue: false, errorText: 'No such app' })); };
      };
    });
    await page.locator('[data-service=youtube]').click();
    assert.deepEqual(await page.evaluate(() => window.lastCall), { uri: 'luna://com.webos.applicationManager/launch', params: { id: 'test.youtube' } });
    assert.match(await page.locator('#toast').textContent(), /Не удалось открыть/); count++;
    await page.evaluate(() => {
      window.PalmServiceBridge = function () { this.call = () => { this.onservicecallback(JSON.stringify({ returnValue: true })); }; };
    });
    await page.reload();
    await page.locator('#settings-button').click();
    await page.locator('#reset-settings').click();
    await page.locator('#close-settings').click();
    assert.equal(await page.locator('.service-card').count(), 12); count++;
    await page.locator('#settings-button').click();
    for (const checkbox of await page.locator('#service-settings input[type=checkbox]').all()) await checkbox.uncheck();
    await page.locator('#close-settings').click();
    await page.locator('#choose-service').click();
    assert.equal(await page.locator('#settings-dialog').evaluate(el => el.open), true);
    assert.equal(await page.locator('#empty-state').evaluate(el => !el.hidden), true);
    await page.locator('#reset-settings').click();
    await page.locator('#close-settings').click(); count++;
    // Navigate the service grid using only the remote's D-pad.
    await page.locator('#choose-service').focus(); await page.keyboard.press('Enter');
    const visited = new Set();
    for (const direction of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft']) {
      visited.add(await page.evaluate(() => document.activeElement.dataset.service)); await page.keyboard.press(direction);
    }
    visited.add(await page.evaluate(() => document.activeElement.dataset.service));
    assert.equal(visited.size, 12); count++;
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#choose-service').evaluate(el => el === document.activeElement), true); count++;
    for (const [width, height] of [[1920, 1080], [1280, 720], [390, 844]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Horizontal overflow at ' + width);
      for (const tile of await page.locator('.service-art').all()) {
        assert.equal(await tile.evaluate(el => el.scrollWidth <= el.clientWidth + 2), true, 'Clipped logo at ' + width);
      }
    } count++;
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => { document.activeElement.blur(); document.getElementById('toast').hidden = true; window.scrollTo(0, 0); });
    await fs.mkdir('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/home-1920.png', fullPage: true });
    assert.deepEqual(errors, []); count++;
    // Persistence disabled or malformed must not break rendering.
    await page.evaluate(() => localStorage.setItem('livingroom.settings.v1', 'null'));
    await page.reload(); assert.equal(await page.locator('.service-card').count(), 12);
    await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new Error('storage disabled'); }; });
    await page.reload(); await page.locator('#settings-button').click(); await page.locator('#visible-youtube').uncheck();
    assert.match(await page.locator('#toast').textContent(), /Не удалось сохранить/);
    assert.equal(await page.locator('[data-service=youtube]').count(), 0); count++;
    console.log(`PASS: ${count} functional checks; screenshots in test-results/`);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
