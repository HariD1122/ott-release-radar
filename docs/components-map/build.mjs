// Builds the Components Map (PDF + PNG preview) with headless Chrome.
//   node docs/components-map/build.mjs
// Output:  docs/Components-Map.pdf                     (safe to share: no login details)
//          docs/private/Components-Map-with-login.pdf   (git-ignored: includes the website address and PIN)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const docs = resolve(here, "..");
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SITE = "ott-release-radar-omega.vercel.app";
const PIN = process.env.SEED_PIN || "(your PIN)";

const COLORS = {
  you: "#b45309", app: "#0b63c5", neon: "#0f766e", tmdb: "#0e7490",
  rapid: "#4f46e5", gemini: "#7c3aed", tg: "#0284c7",
};

// lanes (rows)
const LANES = [
  { id: "A", name: "You", app: "App: this website", color: COLORS.you },
  { id: "B", name: "The App", app: "App: Vercel", color: COLORS.app },
  { id: "C", name: "The Memory", app: "App: Neon database", color: COLORS.neon },
  { id: "D", name: "Movie List", app: "App: TMDB", color: COLORS.tmdb },
  { id: "E", name: "Streaming Check", app: "App: RapidAPI", color: COLORS.rapid },
  { id: "F", name: "AI Model", app: "App: Google Gemini", color: COLORS.gemini },
  { id: "G", name: "Telegram", app: "App: Telegram bot", color: COLORS.tg },
];

const COLS = ["Trigger", "Input", "Context", "Processing", "AI", "Output"];
const CAPTIONS = ["What starts it", "Information given", "Rules and knowledge used", "What the system does", "AI writes / decides", "Result"];

// boxes: id, lane, col (1-6), step number, app label, colour key, text
const BOXES = [
  { id: "a1", lane: "A", col: 1, step: 1, tag: "YOU", c: "you", text: "You open the website and sign in with your PIN, or press <b>Refresh Data</b> / <b>Send This Week's List Now</b>" },
  { id: "b1", lane: "B", col: 1, step: 2, tag: "VERCEL TIMER", c: "app", text: "Two alarms wake the app up: <b>every day 12 PM</b> (fetch news) and <b>every Friday 6 PM</b> (send digest), India time" },
  { id: "d2", lane: "D", col: 2, step: 3, tag: "TMDB", c: "tmdb", text: "Sends this week's releases in India: <b>title, date, genres, language, poster, runtime</b>" },
  { id: "e2", lane: "E", col: 2, step: 4, tag: "RAPIDAPI", c: "rapid", text: "Tells us <b>which streaming app</b> (Netflix, Prime Video, JioHotstar...) really has each title in India" },
  { id: "a2", lane: "A", col: 2, step: 5, tag: "YOUR PROFILE", c: "you", text: "You choose <b>genres, languages, platforms and types</b> once. You tap Like / Dislike on titles" },
  { id: "a3", lane: "A", col: 3, step: 6, tag: "PROFILE PAGE", c: "you", text: "Your choices are <b>saved in the memory</b> and stay until <b>you</b> change them. Every page follows them" },
  { id: "b3", lane: "B", col: 3, step: 7, tag: "THE APP", c: "app", text: "<b>Honest rules:</b> the week runs Fri 6:01 PM to Fri 6:00 PM. No real date = not counted. A platform is shown only when confirmed" },
  { id: "f3", lane: "F", col: 3, step: 8, tag: "GEMINI", c: "gemini", text: "<b>AI's instructions:</b> judge only from your taste and the title facts. Never invent dates, platforms or stories" },
  { id: "b4", lane: "B", col: 4, step: 9, tag: "THE APP", c: "app", text: "Collects, <b>removes duplicates</b>, keeps only titles that match your filters, groups episodes, builds <b>two lists</b>" },
  { id: "c4", lane: "C", col: 4, step: 10, tag: "NEON DATABASE", c: "neon", text: "<b>Remembers</b> every release, your filters, Likes, watchlist and sent messages" },
  { id: "g4", lane: "G", col: 4, step: 12, tag: "TELEGRAM BOT", c: "tg", text: "The app hands the digest to the bot, which <b>delivers it</b> to your chat" },
  { id: "f5", lane: "F", col: 5, step: 11, tag: "GOOGLE GEMINI", c: "gemini", text: "Writes a short <b>Watch / Skip</b> opinion for each title, based on your taste (shown on the website)" },
  { id: "b6", lane: "B", col: 6, step: 13, tag: "THE WEBSITE", c: "app", text: "<b>Carousel</b> of top-rated new releases, <b>New Releases, Movies, Series, Episodes, Watchlist, Weekly Digest, Profile</b>" },
  { id: "g6", lane: "G", col: 6, step: 14, tag: "TELEGRAM", c: "tg", text: "<b>Friday digest:</b> 2 lists, each title with platform, genres, runtime or episodes and a 2-line story" },
  { id: "a6", lane: "A", col: 6, step: 15, tag: "YOU", c: "you", text: "You read the digest on your phone. Likes and Dislikes you give <b>teach the app</b> your taste" },
];

// dashed arrows. mode: H straight across | V straight up/down | RT right, turn in the gutter before the target, enter its left
// | RR right, turn in the gutter after the source column, enter the target's right side | RB go round the right edge of the page area
const EDGES = [
  { f: "a1", t: "b1", m: "V" },
  { f: "b1", t: "d2", m: "RT", ch: 4 },
  { f: "d2", t: "b4", m: "RT", ch: 4 },
  { f: "e2", t: "b4", m: "RT", ch: 9 },
  { f: "a2", t: "a3", m: "H" },
  { f: "a3", t: "b4", m: "RT", ch: 14 },
  { f: "b3", t: "b4", m: "H" },
  { f: "b4", t: "c4", m: "V" },
  { f: "f3", t: "f5", m: "H" },
  { f: "b4", t: "f5", m: "RT", ch: 4 },
  { f: "b4", t: "g4", m: "RR", ch: 4, dy: -28 },
  { f: "b4", t: "b6", m: "H" },
  { f: "f5", t: "b6", m: "RT", ch: 6 },
  { f: "g4", t: "g6", m: "H" },
  { f: "g6", t: "a6", m: "RB" },
  { f: "b6", t: "a6", m: "V" },
];

const APPS = [
  ["TMDB", "A huge online movie and TV library. Tells us what released, when, and the artwork"],
  ["RapidAPI", "A service that tells us which streaming apps carry a title in India"],
  ["Google Gemini", "The AI that writes the short Watch / Skip opinions (it never supplies facts)"],
  ["Neon", "The database: the app's long-term memory for releases, filters and Likes"],
  ["Vercel", "Runs the website live on the internet and wakes the app up on schedule"],
  ["GitHub", "Keeps all the program code safe and versioned"],
  ["Telegram", "The chat app that receives your Friday digest"],
  ["Next.js", "The toolkit the website itself is built with"],
];

const LAYOUT = { W: 1700, labelW: 172, colW: 253, laneH: 120, top: 150, boxH: 104, boxW: 214 };
const laneY = (id) => LAYOUT.top + LANES.findIndex((l) => l.id === id) * LAYOUT.laneH;
const colX = (c) => LAYOUT.labelW + (c - 1) * LAYOUT.colW;
const lanesBottom = LAYOUT.top + LANES.length * LAYOUT.laneH;

function html(withLogin) {
  const lanes = LANES.map(
    (l, i) => `
    <div class="lane ${i % 2 ? "alt" : ""}" style="top:${laneY(l.id)}px;height:${LAYOUT.laneH}px"></div>
    <div class="lanelabel" style="top:${laneY(l.id)}px;height:${LAYOUT.laneH}px;border-left:6px solid ${l.color}">
      <div class="ln">${l.name}</div><div class="la" style="color:${l.color}">${l.app}</div>
    </div>`,
  ).join("");
  const heads = COLS.map((c, i) => `<div class="colhead" style="left:${colX(i + 1)}px;width:${LAYOUT.colW}px">${c}</div>`).join("");
  const caps = CAPTIONS.map((c, i) => `<div class="cap" style="left:${colX(i + 1)}px;width:${LAYOUT.colW}px">${c}</div>`).join("");
  const boxes = BOXES.map((b) => {
    const x = colX(b.col) + (LAYOUT.colW - LAYOUT.boxW) / 2;
    const y = laneY(b.lane) + (LAYOUT.laneH - LAYOUT.boxH) / 2;
    return `<div class="box" id="${b.id}" style="left:${x}px;top:${y}px;width:${LAYOUT.boxW}px;height:${LAYOUT.boxH}px;border-color:${COLORS[b.c]}">
      <div class="tag" style="background:${COLORS[b.c]}"><span class="st">${b.step}</span>${b.tag}</div><div class="bt">${b.text}</div></div>`;
  }).join("");
  const apps = APPS.map(([n, d]) => `<tr><td class="an">${n}</td><td>${d}</td></tr>`).join("");
  const side = withLogin
    ? `<div class="login"><div class="lt">Logins for the OTT Release Radar website (keep this page private)</div>
        <table>
          <tr><td class="k">Website</td><td>${SITE}/login</td></tr>
          <tr><td class="k">Sign in</td><td>PIN only (there is no username)</td></tr>
          <tr><td class="k">PIN</td><td>${PIN}</td></tr>
          <tr><td class="k">GitHub</td><td>github.com/HariD1122/ott-release-radar</td></tr>
          <tr><td class="k">You can</td><td>browse and search every release, set filters, Like / Save titles, press <b>Send This Week's List Now</b>, change the PIN</td></tr>
        </table></div>`
    : `<div class="login"><div class="lt">How to try it</div>
        <table>
          <tr><td class="k">1</td><td>Open the website and sign in with the PIN</td></tr>
          <tr><td class="k">2</td><td>Open <b>Profile</b> and pick your genres, languages and platforms</td></tr>
          <tr><td class="k">3</td><td>Open <b>New Releases</b> to see this week's matching titles</td></tr>
          <tr><td class="k">4</td><td>Press <b>Send This Week's List Now</b>: the digest arrives in Telegram</td></tr>
        </table></div>`;
  const H = lanesBottom + 390;
  return `<!doctype html><html><head><meta charset="utf-8"><title>OTT Release Radar - Components Map</title>
<style>
@page { size: ${LAYOUT.W}px ${H}px; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { width: ${LAYOUT.W}px; height: ${H}px; position: relative; font-family: "Segoe UI", Arial, sans-serif; color: #0b1220; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1 { position: absolute; left: 24px; top: 18px; margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -.5px; }
.sub { position: absolute; left: 24px; top: 62px; width: 1650px; font-size: 15px; color: #334155; line-height: 1.4; }
.colhead { position: absolute; top: 112px; height: 28px; text-align: center; font-weight: 700; font-size: 14px; color: #fff; background: #0b1b30; border-radius: 6px; line-height: 28px; margin: 0 4px; }
.lane { position: absolute; left: 0; width: ${LAYOUT.W}px; background: #f7f9fc; border-top: 1px solid #e2e8f0; }
.lane.alt { background: #eef3f9; }
.lanelabel { position: absolute; left: 10px; width: ${LAYOUT.labelW - 16}px; display: flex; flex-direction: column; justify-content: center; padding-left: 10px; }
.ln { font-weight: 800; font-size: 16px; } .la { font-size: 11.5px; font-weight: 700; margin-top: 3px; }
.box { position: absolute; background: #fff; border: 2px solid; border-radius: 10px; padding: 0; box-shadow: 0 2px 6px rgba(15,23,42,.12); overflow: hidden; }
.tag { color: #fff; font-size: 10px; font-weight: 800; letter-spacing: .6px; padding: 3px 8px 3px 4px; display: flex; align-items: center; gap: 6px; }
.st { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 50%; background: #fff; color: #0b1220; font-size: 10.5px; font-weight: 800; }
.bt { font-size: 12.4px; line-height: 1.3; padding: 6px 9px; color: #1e293b; }
.cap { position: absolute; top: ${lanesBottom + 8}px; text-align: center; font-size: 12.5px; font-weight: 700; color: #334155; border-top: 3px solid #0b63c5; padding-top: 4px; margin: 0 4px; }
svg { position: absolute; left: 0; top: 0; pointer-events: none; }
.apps { position: absolute; left: 24px; top: ${lanesBottom + 50}px; width: 1010px; }
.apps .t, .login .lt { font-weight: 800; font-size: 15px; background: #0b1b30; color: #fff; padding: 6px 10px; border-radius: 6px 6px 0 0; }
.apps table, .login table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.apps td, .login td { padding: 5px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
.an { width: 130px; font-weight: 700; } .k { width: 100px; font-weight: 700; color: #0b63c5; }
.login { position: absolute; left: 1060px; top: ${lanesBottom + 50}px; width: 616px; border: 1px solid #cbd5e1; border-radius: 6px; }
.note { position: absolute; left: 24px; top: ${lanesBottom + 330}px; width: 1650px; font-size: 12.5px; color: #334155; line-height: 1.4; }
</style></head><body>
<h1>OTT Release Radar - From "What came out this week?" to a Friday Telegram Digest - Components Map</h1>
<div class="sub">Follow the numbers and the dashed arrows: a timer wakes the app, it fetches this week's releases, checks where they stream, keeps only what matches <b>your</b> filters, asks the AI for opinions, and shows the result on the website and in Telegram. The small label in each box is the application doing that step.</div>
${heads}${lanes}${boxes}
<svg id="arrows" width="${LAYOUT.W}" height="${H}"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#0b63c5"/></marker></defs></svg>
${caps}
<div class="apps"><div class="t">Applications used</div><table>${apps}</table></div>
${side}
<div class="note"><b>Good to know:</b> Likes and Dislikes only change the <b>Personalized for You</b> list; the <b>Recommended for Your Filters</b> list never uses them. Release dates are calendar dates from TMDB (no exact time), so a title is counted in the week its date falls in. The AI gives opinions only; every date, platform and runtime comes from TMDB and RapidAPI.</div>
<script>
const EDGES = ${JSON.stringify(EDGES)};
const COLX = (c) => ${LAYOUT.labelW} + (c - 1) * ${LAYOUT.colW};
const colOf = (r) => Math.floor((r.l - ${LAYOUT.labelW}) / ${LAYOUT.colW}) + 1;
const svg = document.getElementById("arrows");
const R = (id) => { const e = document.getElementById(id).getBoundingClientRect(); return { l: e.left, r: e.right, t: e.top, b: e.bottom, cx: (e.left + e.right) / 2, cy: (e.top + e.bottom) / 2 }; };
function pts(list) { return list.map(function (p, i) { return (i ? "L" : "M") + p[0] + "," + p[1]; }).join(" "); }
function route(e) {
  const a = R(e.f), b = R(e.t);
  switch (e.m) {
    case "H": return pts([[a.r, a.cy], [b.l - 2, b.cy]]);
    case "V": return b.t > a.b ? pts([[a.cx, a.b], [b.cx, b.t - 2]]) : pts([[a.cx, a.t], [b.cx, b.b + 2]]);
    case "RT": { const x = COLX(colOf(b)) + e.ch; return pts([[a.r, a.cy], [x, a.cy], [x, b.cy], [b.l - 2, b.cy]]); }
    case "RR": { const x = COLX(colOf(b) + 1) + e.ch; const y = b.cy + (e.dy || 0); return pts([[a.r, a.cy], [x, a.cy], [x, y], [b.r + 2, y]]); }
    case "RB": { const x = b.r + 14; return pts([[a.r, a.cy], [x, a.cy], [x, b.cy], [b.r + 2, b.cy]]); }
  }
}
for (const e of EDGES) {
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", route(e));
  p.setAttribute("fill", "none"); p.setAttribute("stroke", "#0b63c5"); p.setAttribute("stroke-width", "2");
  p.setAttribute("stroke-dasharray", "7 5"); p.setAttribute("marker-end", "url(#ah)"); p.setAttribute("opacity", ".9");
  svg.appendChild(p);
}
</script></body></html>`;
}

function render(name, withLogin, outDir) {
  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(outDir, name + ".html");
  writeFileSync(htmlPath, html(withLogin), "utf8");
  const url = pathToFileURL(htmlPath).href;
  const base = ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--virtual-time-budget=4000"];
  execFileSync(CHROME, [...base, "--no-pdf-header-footer", `--print-to-pdf=${join(outDir, name + ".pdf")}`, url], { stdio: "ignore" });
  const H = lanesBottom + 390;
  execFileSync(CHROME, [...base, `--window-size=${LAYOUT.W},${H}`, `--screenshot=${join(outDir, name + ".png")}`, url], { stdio: "ignore" });
  console.log("built", join(outDir, name + ".pdf"));
}

render("Components-Map", false, docs);
render("Components-Map-with-login", true, join(docs, "private"));
