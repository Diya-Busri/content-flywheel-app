/**
 * Puppeteer launcher for Vercel: uses @sparticuz/chromium-min + puppeteer-core only.
 * Keeps serverless bundle under 250MB.
 *
 * chromium-min does NOT bundle the Chromium binary — executablePath() must receive
 * a remote tar URL so it can download the binary at runtime. Without a URL it
 * looks for the binary in .next/server/bin which does not exist on Lambda/Vercel
 * and throws "The input directory ... does not exist".
 *
 * libnss3.so fix: executablePath() sets process.env.LD_LIBRARY_PATH but the child
 * process spawned by Puppeteer may not inherit it. We capture it after the call and
 * pass it explicitly via the env option, also including /usr/lib64 and /usr/lib where
 * Amazon Linux stores system shared libraries.
 */
const CHROMIUM_REMOTE_URL =
  process.env.CHROMIUM_REMOTE_URL ||
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar";

async function launchPuppeteerBrowser() {
  const chromiumMod = require("@sparticuz/chromium-min");
  const chromium = chromiumMod.default ?? chromiumMod;
  const puppeteerCore = require("puppeteer-core");
  const puppeteer = puppeteerCore.default ?? puppeteerCore;

  // executablePath() downloads+extracts the binary AND sets process.env.LD_LIBRARY_PATH
  const execPath = await chromium.executablePath(CHROMIUM_REMOTE_URL);

  // Build a library path that includes:
  // 1. Whatever chromium-min extracted (/tmp/chromium-pack)
  // 2. Amazon Linux system lib dirs where libnss3.so lives
  const libPath = [
    process.env.LD_LIBRARY_PATH,
    "/tmp/chromium-pack",
    "/usr/lib64",
    "/usr/lib",
    "/lib64",
    "/lib",
  ].filter(Boolean).join(":");

  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: execPath,
    headless: chromium.headless,
    timeout: 60000,
    env: {
      ...process.env,
      LD_LIBRARY_PATH: libPath,
    },
  });
}

module.exports = { launchPuppeteerBrowser };
