// Builds the Components Map (PDF + PNG preview) with headless Chrome.
//   node docs/components-map/build.mjs
// Output:  docs/Components-Map.pdf                     (safe to share: no login details)
//          docs/private/Components-Map-with-login.pdf   (git-ignored: includes the website address and PIN)
// Style follows the Aangan Studio reference chart: navy header bar, navy "Who" blocks, pastel lanes,
// boxes colour-coded by stage, dashed arrows, colour legend, "Applications used" + "Logins" panels.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const docs = resolve(here, "..");
const CHROME = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const SITE = "ott-release-radar-omega.vercel.app";
const PIN = process.env.SEED_PIN || "(your PIN)";

// stage colours (same idea as the reference: each column has its own colour)
const STAGES = [
  { name: "Trigger", legend: "What kicks it off", fill: "#ece8fa", line: "#6d4fd0", ink: "#5b3fc4" },
  { name: "Input", legend: "What goes in", fill: "#e1effd", line: "#3b82f6", ink: "#1d63d8" },
  { name: "Context", legend: "Rules it follows", fill: "#e3f6e9", line: "#22a355", ink: "#157a3e" },
  { name: "Processing", legend: "What the app does", fill: "#fff0d4", line: "#f59e0b", ink: "#c26a05" },
  { name: "AI", legend: "What the AI adds", fill: "#fde6f2", line: "#ec4899", ink: "#c2237a" },
  { name: "Output", legend: "What you get", fill: "#fde3df", line: "#ef4444", ink: "#c62828" },
];

const LANES = [
  { id: "A", name: "You", sub: "App: this website", bg: "#e8eefb" },
  { id: "B", name: "OTT Radar App", sub: "App: Vercel", bg: "#fff4d6" },
  { id: "C", name: "The Memory", sub: "App: Neon database", bg: "#e4f5e9" },
  { id: "D", name: "Movie List", sub: "App: TMDB", bg: "#e2f3fb" },
  { id: "E", name: "Streaming Check", sub: "App: RapidAPI", bg: "#efe9fa" },
  { id: "F", name: "AI Assistant", sub: "App: Google Gemini", bg: "#fce7f1" },
  { id: "G", name: "Telegram", sub: "App: Telegram bot", bg: "#fff0df" },
];

// boxes: lane, stage column (1-6), step number, label (the application doing the step), text
const BOXES = [
  { id: "a1", lane: "A", col: 1, step: 1, tag: "YOU", text: "You open the website and sign in with your PIN" },
  { id: "b1", lane: "B", col: 1, step: 2, tag: "VERCEL TIMER", text: "Two alarms wake the app: <b>daily 12&nbsp;PM</b> (fetch new releases) and <b>Friday 6:00&nbsp;PM</b> (send digest), India time" },
  { id: "d2", lane: "D", col: 2, step: 3, tag: "TMDB", text: "Sends this week's releases in India: <b>title, date, genres, language, poster, runtime</b>" },
  { id: "e2", lane: "E", col: 2, step: 4, tag: "RAPIDAPI", text: "Tells us <b>which streaming app</b> (Netflix, Prime Video, JioHotstar...) really has each title in India" },
  { id: "a2", lane: "A", col: 2, step: 5, tag: "YOUR PROFILE", text: "You choose <b>genres, languages, platforms and types</b> once, and tap Like / Dislike on titles" },
  { id: "a3", lane: "A", col: 3, step: 6, tag: "PROFILE PAGE", text: "Your choices are <b>saved in the memory</b> and stay until <b>you</b> change them. Every page follows them" },
  { id: "b3", lane: "B", col: 3, step: 7, tag: "THE APP", text: "<b>Weekly window:</b> last Friday 6:01&nbsp;PM to this Friday 6:00&nbsp;PM (India time). No real date = not counted" },
  { id: "f3", lane: "F", col: 3, step: 8, tag: "GOOGLE GEMINI", text: "<b>AI's instructions:</b> judge only from your taste and the title facts. Never invent dates, platforms or stories" },
  { id: "b4", lane: "B", col: 4, step: 9, tag: "THE APP ON VERCEL", text: "Collects, <b>removes duplicates</b>, keeps only titles matching your filters, groups episodes, builds <b>two lists</b>" },
  { id: "c4", lane: "C", col: 4, step: 10, tag: "NEON DATABASE", text: "<b>Remembers</b> every release, your filters, Likes, watchlist and sent messages" },
  { id: "g4", lane: "G", col: 4, step: 11, tag: "TELEGRAM BOT", text: "The app hands the digest to the bot, which <b>delivers it</b> to your chat" },
  { id: "f5", lane: "F", col: 5, step: 12, tag: "GOOGLE GEMINI", text: "Writes a short <b>Watch / Skip</b> opinion for each title, based on your taste (shown on the website)" },
  { id: "b6", lane: "B", col: 6, step: 13, tag: "THE WEBSITE", text: "<b>Home carousel</b> of top-rated new titles, plus <b>New Releases, Movies, Series, Episodes, Watchlist, Digest, Profile</b>" },
  { id: "g6", lane: "G", col: 6, step: 14, tag: "TELEGRAM", text: "<b>Friday digest:</b> 2 lists, each title with platform, genres, runtime or episodes and a 2-line summary" },
  { id: "a6", lane: "A", col: 6, step: 15, tag: "YOU", text: "You read the digest on your phone. Likes and Dislikes you give <b>teach the app</b> your taste" },
];

// dashed arrows. mode: H straight across | V straight up/down | RT right, turn in the gutter before the target, enter its left
// | RR right, turn in the gutter after the source column, enter the target's right side | RB go round the right edge
const EDGES = [
  { f: "a1", t: "b1", m: "V" },
  { f: "b1", t: "d2", m: "RT", ch: 3 },
  { f: "d2", t: "b4", m: "RT", ch: 3 },
  { f: "e2", t: "b4", m: "RT", ch: 7 },
  { f: "a2", t: "a3", m: "H" },
  { f: "a3", t: "b4", m: "RT", ch: 11 },
  { f: "b3", t: "b4", m: "H" },
  { f: "b4", t: "c4", m: "V" },
  { f: "f3", t: "f5", m: "H" },
  { f: "b4", t: "f5", m: "RT", ch: 3 },
  { f: "b4", t: "g4", m: "RR", ch: 3, dy: -30 },
  { f: "b4", t: "b6", m: "H" },
  { f: "f5", t: "b6", m: "RT", ch: 3 },
  { f: "g4", t: "g6", m: "H" },
  { f: "g6", t: "a6", m: "RB" },
  { f: "b6", t: "a6", m: "V" },
];

const APPS = [
  ["TMDB", "Movie and TV library: what released, when, and the artwork"],
  ["RapidAPI", "Tells us which streaming apps carry a title in India"],
  ["Google Gemini", "The AI that writes the short Watch / Skip opinions (never facts)"],
  ["Neon", "Database: the app's long-term memory for releases, filters and Likes"],
  ["Vercel", "Runs the website live on the internet and wakes the app on schedule"],
  ["GitHub", "Keeps the program code safe and tracks every change"],
  ["Telegram", "The chat app that receives your Friday digest"],
  ["Next.js", "The toolkit the website itself is built with"],
];

const G = { margin: 24, whoW: 190, colW: 244, laneH: 124, headH: 48, gap: 8, boxW: 208, boxH: 108 };
const diagramW = G.whoW + 6 * G.colW; // 1654
const pageW = diagramW + 2 * G.margin; // 1702
const lanesTop = G.headH + G.gap;
const diagramH = lanesTop + LANES.length * G.laneH;
const laneY = (id) => lanesTop + LANES.findIndex((l) => l.id === id) * G.laneH;
const colX = (c) => G.whoW + (c - 1) * G.colW;

function html(withLogin, pageH) {
  const head = `<div class="headbar"><div class="hc who">Who</div>${STAGES.map((s) => `<div class="hc">${s.name}</div>`).join("")}</div>`;
  const lanes = LANES.map(
    (l) => `<div class="lane" style="top:${laneY(l.id)}px;height:${G.laneH}px;background:${l.bg}"></div>
    <div class="whoblock" style="top:${laneY(l.id) + 3}px;height:${G.laneH - 6}px"><div class="wn">${l.name}</div><div class="ws">${l.sub}</div></div>`,
  ).join("");
  const seps = Array.from({ length: 5 }, (_, i) => `<div class="sep" style="left:${colX(i + 2)}px;top:${lanesTop}px;height:${LANES.length * G.laneH}px"></div>`).join("");
  const boxes = BOXES.map((b) => {
    const s = STAGES[b.col - 1];
    const x = colX(b.col) + (G.colW - G.boxW) / 2;
    const y = laneY(b.lane) + (G.laneH - G.boxH) / 2;
    return `<div class="box" id="${b.id}" style="left:${x}px;top:${y}px;width:${G.boxW}px;height:${G.boxH}px;background:${s.fill};border-color:${s.line}">
      <div class="tag" style="color:${s.ink}"><span class="st" style="background:${s.line}">${b.step}</span>${b.tag}</div><div class="bt">${b.text}</div></div>`;
  }).join("");
  const legend = STAGES.map((s) => `<div class="lg"><span class="sw" style="background:${s.fill};border-color:${s.line}"></span>${s.legend}</div>`).join("");
  const apps = APPS.map(([n, d]) => `<div class="r"><span class="k">${n}</span><span>${d}</span></div>`).join("");
  const right = withLogin
    ? `<div class="panel red"><h3>Access details (keep this page private)</h3>
        <div class="r"><span class="k">Website</span><span>${SITE}/login</span></div>
        <div class="r"><span class="k">Sign in</span><span>PIN only (there is no username)</span></div>
        <div class="r"><span class="k">PIN</span><span>${PIN}</span></div>
        <div class="r"><span class="k">GitHub</span><span>github.com/HariD1122/ott-release-radar</span></div>
        <div class="r"><span class="k">You can</span><span>browse and search every release, set your filters, Like and save titles, press <b>Send This Week's List Now</b>, change the PIN</span></div>
      </div>`
    : `<div class="panel red"><h3>How to try it</h3>
        <div class="r"><span class="k">Step 1</span><span>Open the website and sign in with the PIN</span></div>
        <div class="r"><span class="k">Step 2</span><span>Open <b>Profile</b> and pick your genres, languages and platforms</span></div>
        <div class="r"><span class="k">Step 3</span><span>Open <b>New Releases</b> to see this week's matching titles</span></div>
        <div class="r"><span class="k">Step 4</span><span>Press <b>Send This Week's List Now</b>: the digest arrives in Telegram</span></div>
      </div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>OTT Release Radar - Components Map</title>
<style>
@page { size: ${pageW}px ${pageH}px; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { width: ${pageW}px; font-family: "Segoe UI", "DejaVu Sans", Arial, sans-serif; color: #14274e; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 18px ${G.margin}px 22px; }
h1 { margin: 0; text-align: center; font-size: 31px; font-weight: 800; color: #14274e; letter-spacing: -.3px; }
.sub { text-align: center; font-size: 15px; color: #5b6784; margin: 6px 0 16px; }
.diagram { position: relative; width: ${diagramW}px; height: ${diagramH}px; }
.headbar { position: absolute; left: 0; top: 0; width: ${diagramW}px; height: ${G.headH}px; background: #14274e; border-radius: 12px; display: flex; }
.hc { width: ${G.colW}px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 18px; }
.hc.who { width: ${G.whoW}px; }
.lane { position: absolute; left: 0; width: ${diagramW}px; }
.sep { position: absolute; width: 2px; background: #fff; }
.whoblock { position: absolute; left: 0; width: ${G.whoW - 8}px; background: #14274e; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #fff; }
.wn { font-weight: 700; font-size: 19px; } .ws { font-size: 12.5px; color: #c7d0e6; margin-top: 4px; }
.box { position: absolute; border: 2px solid; border-radius: 10px; padding: 8px 10px 6px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
.tag { display: flex; align-items: center; gap: 6px; font-size: 10.8px; font-weight: 800; letter-spacing: .4px; margin-bottom: 4px; }
.st { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 50%; color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: 0; }
.bt { font-size: 12.6px; line-height: 1.3; color: #14274e; }
svg { position: absolute; left: 0; top: 0; pointer-events: none; }
.legend { display: flex; justify-content: space-between; margin: 16px 6px 18px; font-size: 14px; color: #14274e; }
.lg { display: flex; align-items: center; gap: 8px; }
.sw { display: inline-block; width: 26px; height: 18px; border: 2px solid; border-radius: 5px; }
.panels { display: flex; gap: 22px; align-items: stretch; }
.panel { flex: 1; border: 2px solid; border-radius: 12px; padding: 14px 22px 14px; background: #fff; }
.panel.blue { border-color: #3b82f6; background: #f7faff; } .panel.red { border-color: #ef4444; background: #fffafa; }
.panel h3 { margin: 0 0 8px; font-size: 18px; font-weight: 800; color: #14274e; }
.r { display: flex; gap: 14px; padding: 3.5px 0; font-size: 13.5px; line-height: 1.35; }
.k { flex: 0 0 125px; font-weight: 800; }
.note { margin: 14px 6px 0; font-size: 12.5px; color: #5b6784; line-height: 1.45; }
</style></head><body>
<h1>OTT Release Radar · From "What came out this week?" to a Friday Telegram Digest — Components Map</h1>
<div class="sub">How to read this page: start at box 1 and follow the numbers and the dashed arrows. A timer fetches this week's new releases, a second service confirms where each title streams, the app keeps only what matches your profile, the AI adds opinions, and the result reaches you on the website and in Telegram. The coloured tag on each box names the tool doing that step.</div>
<div class="diagram" id="diagram">
${lanes}${seps}${head}${boxes}
<svg id="arrows" width="${diagramW}" height="${diagramH}"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerUnits="userSpaceOnUse" markerWidth="11" markerHeight="11" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#14274e"/></marker></defs></svg>
</div>
<div class="legend">${legend}</div>
<div class="panels"><div class="panel blue"><h3>Tools behind the app</h3>${apps}</div>${right}</div>
<div class="note"><b>Friday time range:</b> each Friday digest covers releases from the <b>previous Friday 6:01 PM up to Friday 6:00 PM, India Standard Time (IST)</b>, both ends included. A platform name is shown only when it is confirmed. Good to know: Likes and Dislikes only change the <b>Personalized for You</b> list; the <b>Recommended for Your Filters</b> list never uses them. Release dates are calendar dates from TMDB (no exact time), so a title counts in the week its date falls in. The AI gives opinions only; every date, platform and runtime comes from TMDB and RapidAPI.</div>
<script>
const EDGES = ${JSON.stringify(EDGES)};
const COLX = (c) => ${G.whoW} + (c - 1) * ${G.colW};
const colOf = (r) => Math.floor((r.l - ${G.whoW}) / ${G.colW}) + 1;
const svg = document.getElementById("arrows");
const origin = document.getElementById("diagram").getBoundingClientRect();
const R = (id) => { const e = document.getElementById(id).getBoundingClientRect(); const l = e.left - origin.left, r = e.right - origin.left, t = e.top - origin.top, b = e.bottom - origin.top; return { l: l, r: r, t: t, b: b, cx: (l + r) / 2, cy: (t + b) / 2 }; };
function pts(list) { return list.map(function (p, i) { return (i ? "L" : "M") + p[0] + "," + p[1]; }).join(" "); }
function route(e) {
  const a = R(e.f), b = R(e.t);
  switch (e.m) {
    case "H": return pts([[a.r, a.cy], [b.l - 2, b.cy]]);
    case "V": return b.t > a.b ? pts([[a.cx, a.b], [b.cx, b.t - 2]]) : pts([[a.cx, a.t], [b.cx, b.b + 2]]);
    case "RT": { const x = COLX(colOf(b)) + e.ch; return pts([[a.r, a.cy], [x, a.cy], [x, b.cy], [b.l - 2, b.cy]]); }
    case "RR": { const x = COLX(colOf(b) + 1) + e.ch; const y = b.cy + (e.dy || 0); return pts([[a.r, a.cy], [x, a.cy], [x, y], [b.r + 2, y]]); }
    case "RB": { const x = b.r + 12; return pts([[a.r, a.cy], [x, a.cy], [x, b.cy], [b.r + 2, b.cy]]); }
  }
}
const drawn = [];
for (const e of EDGES) {
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const d = route(e);
  drawn.push({ e: e, d: d });
  p.setAttribute("d", d);
  p.setAttribute("fill", "none"); p.setAttribute("stroke", "#14274e"); p.setAttribute("stroke-width", "2");
  p.setAttribute("stroke-dasharray", "7 5"); p.setAttribute("marker-end", "url(#ah)");
  svg.appendChild(p);
}
const issues = [];
const boxEls = Array.prototype.slice.call(document.querySelectorAll(".box"));
boxEls.forEach(function (b) {
  // every child (tag line and body text) must lie fully inside the box border, whichever direction it overflows
  const br = b.getBoundingClientRect();
  Array.prototype.slice.call(b.children).forEach(function (c) {
    const cr = c.getBoundingClientRect();
    if (cr.top < br.top + 3 || cr.bottom > br.bottom - 3 || cr.left < br.left + 3 || cr.right > br.right - 3) issues.push("text overflows box " + b.id);
  });
});
for (let i = 0; i < boxEls.length; i++) for (let j = i + 1; j < boxEls.length; j++) {
  const a = boxEls[i].getBoundingClientRect(), b = boxEls[j].getBoundingClientRect();
  if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) issues.push("boxes overlap " + boxEls[i].id + " / " + boxEls[j].id);
}
drawn.forEach(function (x) {
  const nums = x.d.match(/-?[0-9.]+/g).map(Number); const P = [];
  for (let k = 0; k < nums.length; k += 2) P.push([nums[k], nums[k + 1]]);
  for (let k = 0; k + 1 < P.length; k++) {
    const x1 = Math.min(P[k][0], P[k + 1][0]), x2 = Math.max(P[k][0], P[k + 1][0]), y1 = Math.min(P[k][1], P[k + 1][1]), y2 = Math.max(P[k][1], P[k + 1][1]);
    boxEls.forEach(function (b) {
      if (b.id === x.e.f || b.id === x.e.t) return;
      const r = R(b.id);
      if (x2 > r.l + 2 && x1 < r.r - 2 && y2 > r.t + 2 && y1 < r.b - 2) issues.push("arrow " + x.e.f + "->" + x.e.t + " crosses box " + b.id);
    });
  }
});
let prevBottom = 0;
[".legend", ".panels", ".note"].forEach(function (sel) {
  const r = document.querySelector(sel).getBoundingClientRect();
  if (r.top < prevBottom - 0.5) issues.push("section " + sel + " overlaps the one above");
  prevBottom = r.bottom;
});
if (document.getElementById("diagram").getBoundingClientRect().bottom > document.querySelector(".legend").getBoundingClientRect().top) issues.push("diagram overlaps legend");
Array.prototype.slice.call(document.querySelectorAll(".bt, .tag, .k, .wn, .ws, .hc, .r span, .lg, h3, h1, .sub, .note")).forEach(function (el) {
  if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== "inline") issues.push("text clipped in " + (el.className || el.tagName) + ": " + el.textContent.slice(0, 30));
});
document.documentElement.setAttribute("data-qa", JSON.stringify(issues));
document.documentElement.setAttribute("data-h", String(Math.ceil(document.body.getBoundingClientRect().height)));
</script></body></html>`;
}

const base = ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--virtual-time-budget=4000"];

function render(name, withLogin, outDir) {
  mkdirSync(outDir, { recursive: true });
  const htmlPath = join(outDir, name + ".html");
  // pass 1: measure the real content height so the page is exactly as tall as its content (no clipping, no blank tail)
  writeFileSync(htmlPath, html(withLogin, 1500), "utf8");
  const url = pathToFileURL(htmlPath).href;
  const dom = execFileSync(CHROME, [...base, "--dump-dom", url], { maxBuffer: 64 * 1024 * 1024 }).toString();
  const m = dom.match(/data-h="(\d+)"/);
  if (!m) throw new Error("could not measure page height");
  const pageH = Number(m[1]);
  const qa = JSON.parse(dom.match(/data-qa="([^"]*)"/)[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<"));
  console.log(name + " layout check:", qa.length ? qa.length + " problem(s)" : "no overlaps, nothing clipped");
  if (qa.length) { console.log(qa.join(" | ")); process.exitCode = 1; }
  // pass 2: final render at the measured height
  writeFileSync(htmlPath, html(withLogin, pageH), "utf8");
  execFileSync(CHROME, [...base, "--no-pdf-header-footer", `--print-to-pdf=${join(outDir, name + ".pdf")}`, url], { stdio: "ignore" });
  execFileSync(CHROME, [...base, `--window-size=${pageW},${pageH}`, `--screenshot=${join(outDir, name + ".png")}`, url], { stdio: "ignore" });
  console.log("built", join(outDir, name + ".pdf"), `(${pageW} x ${pageH})`);
}

render("Components-Map", false, docs);
render("Components-Map-with-login", true, join(docs, "private"));
