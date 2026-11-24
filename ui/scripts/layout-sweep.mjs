// Layout sweep: every menu style x screen size x page, checked in the running app for layout
// faults (nav buttons off screen or overlapping, text spilling out of a piece, text drawn over
// text, text cut off, tiny text). Findings already reviewed and accepted live in
// layout-baseline.json; the sweep fails only on new ones.
//
//   npm run ui:layout                         every style, every size (needs `npm run ui:dev`)
//   npm run ui:layout -- --styles glass,cs2   some styles
//   npm run ui:layout -- --widths 1100,1280   some sizes
//   npm run ui:layout -- --shots <dir>        save a screenshot of every view with a finding
//   npm run ui:layout -- --update-baseline    accept everything found now (review it first!)
//
// Runs four headless Chromes at once with reduced motion (every animation 1 ms), so the whole
// sweep takes about two minutes.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, evaluate, loadedModule, openChrome, wait } from "./cdp.mjs";
import { findLayoutFaults } from "./layout-checks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(HERE, "layout-baseline.json");
const TYPES_PATH = resolve(HERE, "../src/studio/types.ts");
/** The window sizes people run at: the 1100x680 minimum, 1080p at 150 % and 125 % Windows
 *  scaling (1280x720, 1536x864), laptops, 1080p, 16:10, 1440p and 21:9 ultrawide. */
const VIEWPORTS = [
  [1100, 680], [1280, 720], [1366, 768], [1536, 864], [1920, 1080], [1920, 1200], [2560, 1440], [3440, 1440],
];
const PAGES = ["home", "play", "agents", "collection", "career", "store"];
const FIRST_PORT = 9340;
const WORKERS = 4;
const FIRST_LOAD_MS = 2500;
const STYLE_SWITCH_MS = 400;
/** With reduced motion a page has settled almost at once. */
const SETTLE_MS = 400;
const RECHECK_MS = 1200;

function option(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

/** Every style id, read from the source so a new style is swept without touching this file. */
function styleIds() {
  const source = readFileSync(TYPES_PATH, "utf8");
  const list = source.match(/SKIN_IDS = \[([^\]]*)\]/s)?.[1] ?? "";
  return [...list.matchAll(/"([a-z0-9]+)"/g)].map((match) => match[1]);
}

/** A finding without its exact pixels or the build's class hashes, so it matches across runs. */
function normalized(fault) {
  return fault.replace(/_([A-Za-z][A-Za-z0-9]*)_[a-z0-9]{5}_\d+/g, ".$1").replace(/\d+(\.\d+)?/g, "N");
}

const config = {
  base: option("base") ?? "http://localhost:1420",
  styles: option("styles")?.split(",") ?? styleIds(),
  sizes: VIEWPORTS.filter(([width]) => !option("widths") || option("widths").split(",").includes(String(width))),
  shots: option("shots"),
};
const findings = {};
let finished = 0;

/** The demo backend keeps the Studio document in the page's storage. */
const DEMO_DOC_KEY = "valoshell.demo.doc.layouts.studio";

async function switchStyle(cdp, style) {
  const [width, height] = config.sizes[0];
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  // Every style starts from the default document: a save still in flight from the previous
  // style must not come back with the reload.
  await evaluate(cdp, `(location.origin === ${JSON.stringify(new URL(config.base).origin)} && localStorage.removeItem(${JSON.stringify(DEMO_DOC_KEY)}), 1)`);
  await cdp.send("Page.navigate", { url: `${config.base}/home` });
  await wait(FIRST_LOAD_MS);
  await evaluate(cdp, `import(${loadedModule("/src/state/onboarding.ts")}).then((m) => (m.closeTour(), 1))`);
  await evaluate(cdp, `(async () => {
    const { mutate } = await import(${loadedModule("/src/studio/store.ts")});
    const { SKINS } = await import(${loadedModule("/src/studio/skins/index.ts")});
    // The switch the player makes (style looks and its chat line too), not just the bundle.
    const { switchStyle } = await import(${loadedModule("/src/studio/styleSwitch.ts")});
    mutate((draft) => switchStyle(draft, SKINS.find((skin) => skin.id === ${JSON.stringify(style)})));
  })()`);
  await wait(STYLE_SWITCH_MS);
}

const checkNow = (cdp) => evaluate(cdp, `(${findLayoutFaults.toString()})()`);

/** Faults that are still there a moment later: one caught mid-layout (data or fonts still
 *  arriving while four browsers share the machine) is not a fault. */
async function lastingFaults(cdp) {
  const first = await checkNow(cdp);
  if (first.length === 0) return first;
  await wait(RECHECK_MS);
  const again = new Set((await checkNow(cdp)).map(normalized));
  return first.filter((fault) => again.has(normalized(fault)));
}

async function checkPage(cdp, view) {
  await evaluate(cdp, `(history.pushState({}, "", "/${view.page}"), dispatchEvent(new PopStateEvent("popstate")), 1)`);
  await wait(SETTLE_MS);
  const faults = await lastingFaults(cdp);
  if (faults.length === 0) return;
  findings[`${view.style} ${view.width}x${view.height} ${view.page}`] = faults;
  if (!config.shots) return;
  mkdirSync(config.shots, { recursive: true });
  const { data } = await cdp.send("Page.captureScreenshot", { format: "webp", quality: 70 });
  writeFileSync(join(config.shots, `${view.style}-${view.width}x${view.height}-${view.page}.webp`), Buffer.from(data, "base64"));
}

async function sweepStyle(cdp, style) {
  await switchStyle(cdp, style);
  for (const [width, height] of config.sizes) {
    // Resized in place: the app lays out again without a reload.
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    for (const page of PAGES) await checkPage(cdp, { style, width, height, page });
    finished += 1;
    console.log(`[${finished}/${config.styles.length * config.sizes.length}] ${style} ${width}x${height}`);
  }
}

async function worker(index, styles) {
  const [width, height] = config.sizes[0];
  const chrome = await openChrome(FIRST_PORT + index, { width, height });
  try {
    const cdp = await connect(chrome.url);
    await cdp.send("Page.enable");
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    for (const style of styles) await sweepStyle(cdp, style);
    cdp.close();
  } finally {
    chrome.close();
  }
}

/** Compare against the accepted findings: new ones fail the run, vanished ones are reported. */
function compareWithBaseline() {
  const seen = new Set(Object.entries(findings).flatMap(([view, faults]) => {
    const [style, , page] = view.split(" ");
    return faults.map((fault) => `${style} ${page} ${normalized(fault)}`);
  }));
  if (process.argv.includes("--update-baseline")) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify({ accepted: [...seen].sort() }, null, 2)}\n`);
    console.log(`Baseline updated: ${seen.size} accepted findings.`);
    return 0;
  }
  const accepted = new Set(JSON.parse(readFileSync(BASELINE_PATH, "utf8")).accepted);
  const swept = (key) => config.styles.includes(key.split(" ")[0]);
  const fresh = [...seen].filter((key) => !accepted.has(key));
  const gone = [...accepted].filter((key) => swept(key) && !seen.has(key));
  for (const key of gone) console.log(`  fixed? ${key} (no longer seen; drop it from the baseline)`);
  for (const key of fresh) console.log(`  NEW   ${key}`);
  console.log(fresh.length === 0 ? "No new layout faults." : `${fresh.length} new layout faults.`);
  return fresh.length === 0 ? 0 : 1;
}

async function main() {
  const groups = Array.from({ length: WORKERS }, (_, index) => config.styles.filter((_, at) => at % WORKERS === index));
  await Promise.all(groups.filter((group) => group.length > 0).map((group, index) => worker(index, group)));
  process.exitCode = compareWithBaseline();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
