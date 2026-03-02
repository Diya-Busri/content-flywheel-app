/**
 * Puppeteer launcher for Vercel: uses @sparticuz/chromium-min + puppeteer-core only.
 * Keeps serverless bundle under 250MB.
 */
async function launchPuppeteerBrowser() {
  const chromiumMod = require("@sparticuz/chromium-min");
  const chromium = chromiumMod.default ?? chromiumMod;
  const puppeteerCore = require("puppeteer-core");
  const puppeteer = puppeteerCore.default ?? puppeteerCore;
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    timeout: 60000,
  });
}

module.exports = { launchPuppeteerBrowser };
