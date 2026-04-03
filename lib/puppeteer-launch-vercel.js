/**
 * Puppeteer launcher for Vercel: uses @sparticuz/chromium-min + puppeteer-core only.
 * Keeps serverless bundle under 250MB.
 *
 * chromium-min does NOT bundle the Chromium binary — executablePath() must receive
 * a remote tar URL so it can download the binary at runtime. Without a URL it
 * looks for the binary in .next/server/bin which does not exist on Lambda/Vercel
 * and throws "The input directory ... does not exist".
 */
const CHROMIUM_REMOTE_URL =
  process.env.CHROMIUM_REMOTE_URL ||
  "https://github.com/Sparticuz/chromium/releases/download/v119.0.0/chromium-v119.0.0-pack.tar";

async function launchPuppeteerBrowser() {
  const chromiumMod = require("@sparticuz/chromium-min");
  const chromium = chromiumMod.default ?? chromiumMod;
  const puppeteerCore = require("puppeteer-core");
  const puppeteer = puppeteerCore.default ?? puppeteerCore;
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(CHROMIUM_REMOTE_URL),
    headless: chromium.headless,
    timeout: 60000,
  });
}

module.exports = { launchPuppeteerBrowser };
