/**
 * CF Video Engine – Placeholder Visual Generator
 *
 * Generates richly-styled SVG placeholder images for each of the 5 scene types.
 * No external APIs — pure server-side string construction.
 *
 * Used so the render pipeline can be fully tested before real assets (Higgsfield AI,
 * uploaded images) are available.
 *
 * Scene types:
 *   ai_visual      → cinematic dark space / nebula gradient with star particles
 *   app_screenshot → dark-mode SaaS dashboard mockup
 *   product_mockup → ebook / digital product card mockup
 *   cta            → branded orange gradient CTA slide
 *   text_slide     → minimal animated dark background with subtle lines
 */

export type PlaceholderScene = {
  id: string;
  sceneNumber: number;
  sceneType: 'ai_visual' | 'app_screenshot' | 'product_mockup' | 'cta' | 'text_slide';
  onScreenText?: string;
};

// Canvas size matches the Remotion composition (1080 × 1920, 9:16)
const W = 1080;
const H = 1920;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function svgWrap(id: string, defs: string, content: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    ${defs}
  </defs>
  ${content}
  <!-- placeholder:${id} -->
</svg>`;
}

/** Spread N pseudo-random stars using a seeded LCG so output is deterministic */
function stars(seed: number, count: number, r = 2, opacity = 0.8): string {
  let s = seed;
  const lcg = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
  return Array.from({ length: count }, () => {
    const x = Math.round(lcg() * W);
    const y = Math.round(lcg() * H);
    const rr = (lcg() * r + 0.5).toFixed(1);
    const op = (lcg() * opacity * 0.6 + 0.2).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="${rr}" fill="#fff" opacity="${op}"/>`;
  }).join('');
}

// ─── Scene-type generators ────────────────────────────────────────────────────

/** ai_visual — cinematic dark space aesthetic */
function genAiVisual(scene: PlaceholderScene): string {
  const defs = `
    <linearGradient id="bg" x1="0" y1="0" x2="0.6" y2="1" gradientUnits="objectBoundingBox">
      <stop offset="0%"   stop-color="#0f0c29"/>
      <stop offset="50%"  stop-color="#302b63"/>
      <stop offset="100%" stop-color="#24243e"/>
    </linearGradient>
    <radialGradient id="nebula" cx="40%" cy="35%" r="55%">
      <stop offset="0%"   stop-color="#7c3aed" stop-opacity="0.35"/>
      <stop offset="60%"  stop-color="#4f46e5" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#0f0c29" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="nebula2" cx="70%" cy="70%" r="45%">
      <stop offset="0%"   stop-color="#ec4899" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#0f0c29" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  `;

  const label = scene.onScreenText?.slice(0, 30) || `AI Visual · Scene ${scene.sceneNumber}`;

  const content = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${H}" fill="url(#nebula)"/>
    <rect width="${W}" height="${H}" fill="url(#nebula2)"/>
    ${stars(scene.sceneNumber * 17 + 3, 180, 2.5, 0.85)}
    <!-- Glow orb -->
    <ellipse cx="432" cy="700" rx="260" ry="260" fill="#7c3aed" opacity="0.08" filter="url(#glow)"/>
    <!-- Label chip -->
    <rect x="60" y="80" width="220" height="52" rx="26" fill="rgba(0,0,0,0.5)" stroke="#a78bfa" stroke-width="1.5" stroke-opacity="0.5"/>
    <text x="170" y="113" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22" font-weight="700"
          fill="#a78bfa" letter-spacing="2" text-anchor="middle" text-transform="uppercase">AI VISUAL</text>
    <!-- Scene number -->
    <text x="${W - 60}" y="116" font-family="ui-sans-serif,system-ui,sans-serif" font-size="26"
          fill="rgba(255,255,255,0.4)" font-weight="600" text-anchor="end" letter-spacing="2">${scene.sceneNumber}</text>
    <!-- Centre label -->
    <text x="${W / 2}" y="${H / 2 + 16}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="42"
          font-weight="900" fill="rgba(255,255,255,0.2)" text-anchor="middle">${escapeXml(label)}</text>
    <!-- Bottom accent stripe -->
    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#a78bfa" opacity="0.7"/>
  `;

  return svgWrap(scene.id, defs, content);
}

/** app_screenshot — dark-mode SaaS dashboard mockup */
function genAppScreenshot(scene: PlaceholderScene): string {
  const defs = `
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#1c2128"/>
    </linearGradient>
    <linearGradient id="bar1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <linearGradient id="bar2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  `;

  const CARD = (x: number, y: number, w: number, h: number, title: string, value: string, color: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#161b22" stroke="#30363d" stroke-width="1"/>
     <text x="${x + 20}" y="${y + 36}" font-family="ui-sans-serif,sans-serif" font-size="18" fill="#8b949e" font-weight="600">${title}</text>
     <text x="${x + 20}" y="${y + 78}" font-family="ui-monospace,monospace" font-size="38" fill="${color}" font-weight="800">${value}</text>`;

  const ROW = (x: number, y: number, w: number, label: string, pct: number, color: string) => {
    const barW = Math.round(pct / 100 * (w - 40));
    return `<rect x="${x}" y="${y}" width="${w}" height="44" rx="8" fill="#0d1117" stroke="#21262d" stroke-width="1"/>
     <text x="${x + 16}" y="${y + 27}" font-family="ui-sans-serif,sans-serif" font-size="16" fill="#8b949e">${label}</text>
     <rect x="${x + 16}" y="${y + 32}" width="${barW}" height="6" rx="3" fill="${color}" opacity="0.8"/>`;
  };

  const content = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <!-- Topbar -->
    <rect x="0" y="0" width="${W}" height="110" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <!-- label chip -->
    <rect x="60" y="30" width="260" height="52" rx="26" fill="rgba(0,0,0,0.5)" stroke="#60a5fa" stroke-width="1.5" stroke-opacity="0.5"/>
    <text x="190" y="63" font-family="ui-sans-serif,sans-serif" font-size="20" font-weight="700"
          fill="#60a5fa" letter-spacing="2" text-anchor="middle">APP SCREENSHOT</text>
    <text x="${W - 60}" y="68" font-family="ui-sans-serif,sans-serif" font-size="26"
          fill="rgba(255,255,255,0.4)" font-weight="600" text-anchor="end" letter-spacing="2">${scene.sceneNumber}</text>

    <!-- Stat cards row 1 -->
    ${CARD(60,  140, 460, 130, 'Total Revenue',  '$12,480', '#60a5fa')}
    ${CARD(560, 140, 460, 130, 'Active Users',   '3,204',   '#34d399')}
    <!-- Stat cards row 2 -->
    ${CARD(60,  300, 460, 130, 'Conversions',    '8.4%',    '#f59e0b')}
    ${CARD(560, 300, 460, 130, 'New Signups',    '142',     '#a78bfa')}

    <!-- Chart area -->
    <rect x="60" y="460" width="960" height="420" rx="14" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="84" y="502" font-family="ui-sans-serif,sans-serif" font-size="20" fill="#8b949e" font-weight="600">Revenue (last 7 days)</text>
    <!-- Bars -->
    <rect x="120"  y="680" width="80" height="160" rx="6" fill="url(#bar1)" opacity="0.85"/>
    <rect x="240"  y="640" width="80" height="200" rx="6" fill="url(#bar1)" opacity="0.85"/>
    <rect x="360"  y="600" width="80" height="240" rx="6" fill="url(#bar1)" opacity="0.85"/>
    <rect x="480"  y="560" width="80" height="280" rx="6" fill="url(#bar2)" opacity="0.9"/>
    <rect x="600"  y="580" width="80" height="260" rx="6" fill="url(#bar2)" opacity="0.9"/>
    <rect x="720"  y="520" width="80" height="320" rx="6" fill="url(#bar2)" opacity="0.9"/>
    <rect x="840"  y="490" width="80" height="350" rx="6" fill="url(#bar1)" opacity="0.95"/>

    <!-- Activity list -->
    <rect x="60"  y="920" width="960" height="52" rx="8" fill="#161b22" stroke="#21262d" stroke-width="1"/>
    <text x="84"  y="952" font-family="ui-sans-serif,sans-serif" font-size="17" fill="#c9d1d9">📈  Content Flywheel · Revenue chart</text>

    ${ROW(60, 992, 960, 'Dashboard Analytics', 82, '#60a5fa')}
    ${ROW(60, 1050, 960, 'Video Engine renders',  67, '#a78bfa')}
    ${ROW(60, 1108, 960, 'Conversion rate',       91, '#34d399')}
    ${ROW(60, 1166, 960, 'Active campaigns',       55, '#f59e0b')}

    <!-- Bottom panel -->
    <rect x="60" y="1240" width="960" height="300" rx="14" fill="#161b22" stroke="#30363d" stroke-width="1"/>
    <text x="84" y="1280" font-family="ui-sans-serif,sans-serif" font-size="20" fill="#8b949e" font-weight="600">Recent Uploads</text>
    ${[0, 1, 2, 3].map(i =>
      `<rect x="84"  y="${1300 + i * 58}" width="${750}" height="44" rx="6" fill="#0d1117" stroke="#21262d" stroke-width="1"/>
       <circle cx="110" cy="${1300 + i * 58 + 22}" r="14" fill="#30363d"/>
       <rect x="136"  y="${1300 + i * 58 + 12}" width="${200 - i * 20}" height="10" rx="5" fill="#30363d"/>
       <rect x="136"  y="${1300 + i * 58 + 30}" width="${120 - i * 10}" height="8"  rx="4" fill="#21262d"/>`
    ).join('')}

    <!-- Bottom accent stripe -->
    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#60a5fa" opacity="0.7"/>
  `;

  return svgWrap(scene.id, defs, content);
}

/** product_mockup — digital ebook / product card */
function genProductMockup(scene: PlaceholderScene): string {
  const defs = `
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%"  stop-color="#1a1a2e"/>
      <stop offset="100%" stop-color="#0f3460"/>
    </linearGradient>
    <linearGradient id="cover" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="#34d399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="24" stdDeviation="32" flood-color="#000" flood-opacity="0.6"/>
    </filter>
  `;

  const bookX = 180, bookY = 400, bookW = 720, bookH = 900;

  const content = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <!-- label chip -->
    <rect x="60" y="80" width="265" height="52" rx="26" fill="rgba(0,0,0,0.5)" stroke="#34d399" stroke-width="1.5" stroke-opacity="0.5"/>
    <text x="193" y="113" font-family="ui-sans-serif,sans-serif" font-size="20" font-weight="700"
          fill="#34d399" letter-spacing="2" text-anchor="middle">PRODUCT MOCKUP</text>
    <text x="${W - 60}" y="116" font-family="ui-sans-serif,sans-serif" font-size="26"
          fill="rgba(255,255,255,0.4)" font-weight="600" text-anchor="end" letter-spacing="2">${scene.sceneNumber}</text>

    <!-- Book shadow -->
    <rect x="${bookX}" y="${bookY}" width="${bookW}" height="${bookH}" rx="18" fill="#000" opacity="0.35" filter="url(#shadow)"/>
    <!-- Book cover -->
    <rect x="${bookX}" y="${bookY}" width="${bookW}" height="${bookH}" rx="18" fill="url(#cover)"/>
    <!-- Spine highlight -->
    <rect x="${bookX}" y="${bookY}" width="28" height="${bookH}" rx="18" fill="rgba(255,255,255,0.15)"/>
    <!-- Cover texture lines -->
    <line x1="${bookX + 60}" y1="${bookY + 80}"  x2="${bookX + bookW - 60}" y2="${bookY + 80}"  stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
    <line x1="${bookX + 60}" y1="${bookY + 110}" x2="${bookX + bookW - 60}" y2="${bookY + 110}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    <!-- Title area -->
    <rect x="${bookX + 60}" y="${bookY + 150}" width="${bookW - 120}" height="220" rx="10" fill="rgba(0,0,0,0.25)"/>
    <text x="${bookX + bookW / 2}" y="${bookY + 230}" font-family="ui-sans-serif,sans-serif" font-size="36"
          font-weight="900" fill="#fff" text-anchor="middle">CONTENT</text>
    <text x="${bookX + bookW / 2}" y="${bookY + 280}" font-family="ui-sans-serif,sans-serif" font-size="36"
          font-weight="900" fill="#fff" text-anchor="middle">FLYWHEEL</text>
    <text x="${bookX + bookW / 2}" y="${bookY + 334}" font-family="ui-sans-serif,sans-serif" font-size="22"
          font-weight="600" fill="rgba(255,255,255,0.7)" text-anchor="middle">Complete Guide</text>
    <!-- Divider -->
    <line x1="${bookX + 120}" y1="${bookY + 400}" x2="${bookX + bookW - 120}" y2="${bookY + 400}" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <!-- Body text lines (fake) -->
    ${[440, 490, 540, 590, 640, 690].map((dy, i) =>
      `<rect x="${bookX + 80}" y="${bookY + dy}" width="${bookW - (i % 2 === 1 ? 200 : 160)}" height="18" rx="9" fill="rgba(255,255,255,0.2)"/>`
    ).join('')}
    <!-- Star rating -->
    <text x="${bookX + bookW / 2}" y="${bookY + 820}" font-family="ui-sans-serif,sans-serif" font-size="42"
          text-anchor="middle">⭐⭐⭐⭐⭐</text>
    <!-- Price tag -->
    <rect x="${bookX + bookW / 2 - 100}" y="${bookY + bookH - 100}" width="200" height="60" rx="30"
          fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.3)" stroke-width="1.5"/>
    <text x="${bookX + bookW / 2}" y="${bookY + bookH - 62}" font-family="ui-monospace,monospace"
          font-size="26" font-weight="800" fill="#fff" text-anchor="middle">$27</text>

    <!-- Below-book caption -->
    <text x="${W / 2}" y="${bookY + bookH + 80}" font-family="ui-sans-serif,sans-serif" font-size="30"
          font-weight="700" fill="rgba(255,255,255,0.6)" text-anchor="middle">Digital Product</text>

    <!-- Bottom accent stripe -->
    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#34d399" opacity="0.7"/>
  `;

  return svgWrap(scene.id, defs, content);
}

/** cta — branded orange gradient CTA slide */
function genCta(scene: PlaceholderScene): string {
  const defs = `
    <linearGradient id="bg" x1="0" y1="0" x2="0.5" y2="1">
      <stop offset="0%"   stop-color="#c05621"/>
      <stop offset="50%"  stop-color="#F89520"/>
      <stop offset="100%" stop-color="#f6ad55"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="48%" r="55%">
      <stop offset="0%"   stop-color="#fff" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#c05621" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="40"/>
    </filter>
  `;

  const content = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <rect width="${W}" height="${H}" fill="url(#glow)"/>
    <!-- Diagonal texture lines -->
    ${Array.from({ length: 28 }, (_, i) => {
      const x = i * 80 - 200;
      return `<line x1="${x}" y1="0" x2="${x + H * 0.3}" y2="${H}" stroke="rgba(255,255,255,0.04)" stroke-width="60"/>`;
    }).join('')}
    <!-- Arrow / spark accent -->
    <text x="${W / 2}" y="720" font-family="ui-sans-serif,sans-serif" font-size="160"
          text-anchor="middle" opacity="0.2">→</text>
    <!-- label chip -->
    <rect x="60" y="80" width="140" height="52" rx="26" fill="rgba(0,0,0,0.25)" stroke="rgba(255,255,255,0.5)" stroke-width="1.5"/>
    <text x="130" y="113" font-family="ui-sans-serif,sans-serif" font-size="22" font-weight="700"
          fill="#fff" letter-spacing="2" text-anchor="middle">CTA</text>
    <text x="${W - 60}" y="116" font-family="ui-sans-serif,sans-serif" font-size="26"
          fill="rgba(255,255,255,0.6)" font-weight="600" text-anchor="end" letter-spacing="2">${scene.sceneNumber}</text>

    <!-- Main headline -->
    <text x="${W / 2}" y="${H / 2 - 140}" font-family="ui-sans-serif,sans-serif" font-size="86"
          font-weight="900" fill="#fff" text-anchor="middle" letter-spacing="-2">START TODAY</text>
    <text x="${W / 2}" y="${H / 2 - 40}" font-family="ui-sans-serif,sans-serif" font-size="42"
          font-weight="700" fill="rgba(255,255,255,0.85)" text-anchor="middle">7-Day Free Trial</text>

    <!-- Button -->
    <rect x="${W / 2 - 280}" y="${H / 2 + 40}" width="560" height="100" rx="50"
          fill="#fff"/>
    <text x="${W / 2}" y="${H / 2 + 103}" font-family="ui-sans-serif,sans-serif" font-size="32"
          font-weight="900" fill="#F89520" text-anchor="middle">contentflywheel.com</text>

    <!-- Urgency line -->
    <text x="${W / 2}" y="${H / 2 + 220}" font-family="ui-sans-serif,sans-serif" font-size="28"
          fill="rgba(255,255,255,0.75)" text-anchor="middle">No credit card required · Cancel anytime</text>

    <!-- Bottom accent stripe -->
    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="rgba(255,255,255,0.5)"/>
  `;

  return svgWrap(scene.id, defs, content);
}

/** text_slide — minimal dark background with grid & accent lines */
function genTextSlide(scene: PlaceholderScene): string {
  const defs = `
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#0a0a0a"/>
      <stop offset="100%" stop-color="#111111"/>
    </linearGradient>
  `;

  const label = scene.onScreenText?.slice(0, 28) || 'Text Slide';

  const content = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <!-- Subtle grid -->
    ${Array.from({ length: 20 }, (_, i) =>
      `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="${H}" stroke="rgba(255,255,255,0.025)" stroke-width="1"/>`
    ).join('')}
    ${Array.from({ length: 36 }, (_, i) =>
      `<line x1="0" y1="${i * 60}" x2="${W}" y2="${i * 60}" stroke="rgba(255,255,255,0.025)" stroke-width="1"/>`
    ).join('')}
    <!-- Accent horizontal rule -->
    <line x1="80" y1="${H / 2 - 180}" x2="${W - 80}" y2="${H / 2 - 180}" stroke="#9ca3af" stroke-width="1.5" opacity="0.4"/>
    <line x1="80" y1="${H / 2 + 120}" x2="${W - 80}" y2="${H / 2 + 120}" stroke="#9ca3af" stroke-width="1.5" opacity="0.4"/>
    <!-- label chip -->
    <rect x="60" y="80" width="210" height="52" rx="26" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
    <text x="165" y="113" font-family="ui-sans-serif,sans-serif" font-size="20" font-weight="700"
          fill="#9ca3af" letter-spacing="2" text-anchor="middle">TEXT SLIDE</text>
    <text x="${W - 60}" y="116" font-family="ui-sans-serif,sans-serif" font-size="26"
          fill="rgba(255,255,255,0.3)" font-weight="600" text-anchor="end" letter-spacing="2">${scene.sceneNumber}</text>
    <!-- Centre label -->
    <text x="${W / 2}" y="${H / 2 + 20}" font-family="ui-sans-serif,sans-serif" font-size="56"
          font-weight="900" fill="rgba(255,255,255,0.15)" text-anchor="middle">${escapeXml(label)}</text>
    <!-- Corner dots -->
    <circle cx="80"       cy="${H / 2}" r="6" fill="#9ca3af" opacity="0.3"/>
    <circle cx="${W - 80}" cy="${H / 2}" r="6" fill="#9ca3af" opacity="0.3"/>
    <!-- Bottom accent stripe -->
    <rect x="0" y="${H - 6}" width="${W}" height="6" fill="#9ca3af" opacity="0.7"/>
  `;

  return svgWrap(scene.id, defs, content);
}

// ─── Escape XML ───────────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a deterministic SVG string for a given scene.
 * The SVG is 1080 × 1920 px (9:16 vertical), suitable for use as a full-screen
 * background in the Remotion composition.
 */
export function generatePlaceholderSvg(scene: PlaceholderScene): string {
  switch (scene.sceneType) {
    case 'ai_visual':      return genAiVisual(scene);
    case 'app_screenshot': return genAppScreenshot(scene);
    case 'product_mockup': return genProductMockup(scene);
    case 'cta':            return genCta(scene);
    case 'text_slide':     return genTextSlide(scene);
    default:               return genTextSlide(scene);
  }
}
