// Gallery thumbnails: a screenshot of each look's Home page, taken from the app's own preview
// mode (`?look-preview`: demo data, nothing saved) in headless Chrome, so a card shows exactly
// what applying the look gives.
//
//   node ui/scripts/look-thumbs.mjs starters              every starter look
//   node ui/scripts/look-thumbs.mjs community [id ...]    the named looks plus any without one
//
// Needs the dev server (`npm run ui:dev`); `--base <url>` when it is not on port 1420, and
// CHROME=<path> when Chrome is not in its usual place. Community mode also deletes pictures
// whose look is gone.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALE, connect, evaluate, openChrome, wait } from "./cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const STARTER_THUMBS = join(ROOT, "ui/src/studio/gallery/thumbs");
const COMMUNITY_LOOKS = join(ROOT, "community/looks");
const COMMUNITY_THUMBS = join(ROOT, "community/thumbs");
const DEFAULT_BASE = "http://localhost:1420";
const DEBUG_PORT = 9334;
// The preview frame's size (previewProtocol.ts), shot at 0.4: a 640x360 card picture.
const VIEW = { width: 1600, height: 900 };
const THUMB_SCALE = 0.4;
const WEBP_QUALITY = 82;
// The app takes a moment to start in a fresh tab.
const READY_ATTEMPTS = 60;
const READY_RETRY_MS = 250;
// Long enough for the look's entrance motion (the longest stagger ends near 1.6 s) to settle.
const SETTLE_MS = 3000;

function parseArgs(argv) {
  const baseAt = argv.indexOf("--base");
  const hasBase = baseAt >= 0;
  const base = hasBase ? argv[baseAt + 1] : DEFAULT_BASE;
  const rest = hasBase ? argv.filter((_, index) => index !== baseAt && index !== baseAt + 1) : argv;
  const [mode, ...ids] = rest;
  if (mode !== "starters" && mode !== "community") {
    throw new Error('Say which looks: "starters" or "community [id ...]".');
  }
  return { base, mode, ids };
}

/** Load the preview page and wait until the app has drawn its Home stage. */
async function openPreview(cdp, base) {
  await cdp.send("Page.navigate", { url: `${base}/?look-preview` });
  for (let attempt = 0; attempt < READY_ATTEMPTS; attempt += 1) {
    await wait(READY_RETRY_MS);
    const isReady = await evaluate(cdp, `document.querySelector('[data-part="piece"]') !== null`).catch(() => false);
    if (isReady) return;
  }
  throw new Error(`The app did not start at ${base}. Is the dev server running (npm run ui:dev)?`);
}

/** Show `doc` the way the gallery does (the preview takes it from its own window at top level). */
async function shootLook(cdp, { base, doc, file }) {
  await openPreview(cdp, base);
  const message = { kind: "valoshell-preview-show", doc, page: "home" };
  await evaluate(cdp, `window.postMessage(${JSON.stringify(message)}, window.location.origin)`);
  await wait(SETTLE_MS);
  const clip = { x: 0, y: 0, ...VIEW, scale: THUMB_SCALE };
  const { data } = await cdp.send("Page.captureScreenshot", { format: "webp", quality: WEBP_QUALITY, clip });
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log(`saved ${basename(file)}`);
}

/** The starter looks' documents, built by the app's own code in the page. */
async function starterJobs(cdp, base) {
  await openPreview(cdp, base);
  const looks = await evaluate(
    cdp,
    `import("/src/studio/gallery/starterLooks.ts").then((m) =>
      m.STARTER_LOOKS.map((look) => ({ id: look.id, doc: m.starterDoc(look) })))`,
  );
  mkdirSync(STARTER_THUMBS, { recursive: true });
  return looks.map(({ id, doc }) => ({ doc, file: join(STARTER_THUMBS, `${id}.webp`) }));
}

/** Community looks that need a picture: the ones named, and any that have none yet. */
function communityJobs(ids) {
  mkdirSync(COMMUNITY_THUMBS, { recursive: true });
  const looks = readdirSync(COMMUNITY_LOOKS).filter((name) => name.endsWith(".json")).map((name) => basename(name, ".json"));
  for (const picture of readdirSync(COMMUNITY_THUMBS)) {
    if (!looks.includes(basename(picture, ".webp"))) rmSync(join(COMMUNITY_THUMBS, picture));
  }
  const thumbOf = (id) => join(COMMUNITY_THUMBS, `${id}.webp`);
  return looks
    .filter((id) => ids.includes(id) || !existsSync(thumbOf(id)))
    .map((id) => ({ doc: JSON.parse(readFileSync(join(COMMUNITY_LOOKS, `${id}.json`), "utf8")), file: thumbOf(id) }));
}

async function main() {
  const { base, mode, ids } = parseArgs(process.argv.slice(2));
  const chrome = await openChrome(DEBUG_PORT, VIEW);
  try {
    const cdp = await connect(chrome.url);
    await cdp.send("Emulation.setDeviceMetricsOverride", { ...VIEW, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Emulation.setLocaleOverride", { locale: LOCALE });
    const jobs = mode === "starters" ? await starterJobs(cdp, base) : communityJobs(ids);
    for (const job of jobs) await shootLook(cdp, { base, ...job });
    console.log(`${jobs.length} thumbnails made`);
    cdp.close();
  } finally {
    chrome.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
