/**
 * Returns the correct Puppeteer launcher: on Vercel uses chromium-min + puppeteer-core
 * (stays under 250MB); locally uses full puppeteer.
 */
if (process.env.VERCEL) {
  module.exports = require("./puppeteer-launch-vercel");
} else {
  module.exports = require("./puppeteer-launch-local");
}
