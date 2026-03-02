/**
 * Puppeteer launcher for local dev: uses full puppeteer (bundles Chromium).
 */
async function launchPuppeteerBrowser() {
  const puppeteer = require("puppeteer");
  return puppeteer.launch({
    headless: true,
    timeout: 60000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });
}

module.exports = { launchPuppeteerBrowser };
