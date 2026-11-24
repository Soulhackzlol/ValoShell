// Look sweep: every style's own looks (its Play, Rank, Agent select, Results... from the Studio
// jobs) checked for the same layout faults as the layout sweep, which only sees the looks the
// default layouts place. Each look is shown alone at its registry size in the app's preview mode
// (demo data, nothing saved), at the smallest, the common and the widest window. Findings
// already reviewed live in look-baseline.json; the sweep fails only on new ones.
//
//   npm run ui:looks                          every style (needs `npm run ui:dev`)
//   npm run ui:looks -- --styles cs2,halo     some styles
//   npm run ui:looks -- --raw                 print each finding with its pixels and window size
//   npm run ui:looks -- --update-baseline     accept everything found now (review it first!)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, evaluate, openChrome, wait } from "./cdp.mjs";
import { findLayoutFaults } from "./layout-checks.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(HERE, "look-baseline.json");
/** The 1100x680 minimum, 1080p and 21:9 ultrawide: the looks' extremes and the usual case. */
const VIEWPORTS = [[1100, 680], [1920, 1080], [3440, 1440]];
/** The demo page each job's look is shown on (the preview sets up its data). */
const PAGE_OF_JOB = { pick: "agent-select", lobby: "live", results: "post-match", store: "store", career: "career" };
const FIRST_PORT = 9360;
const WORKERS = 4;
const READY_ATTEMPTS = 80;
const READY_RETRY_MS = 250;
const SETTLE_MS = 900;
const RECHECK_MS = 1000;

function option(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

const base = option("base") ?? "http://localhost:1420";
const onlyStyles = option("styles")?.split(",");
const findings = new Set();

/** A finding without exact pixels or class hashes, so it matches across runs (as layout-sweep). */
function normalized(fault) {
  return fault.replace(/_([A-Za-z][A-Za-z0-9]*)_[a-z0-9]{5}_\d+/g, ".$1").replace(/\d+(\.\d+)?/g, "N");
}

async function openPreview(cdp) {
  await cdp.send("Page.navigate", { url: `${base}/?look-preview` });
  for (let attempt = 0; attempt < READY_ATTEMPTS; attempt += 1) {
    await wait(READY_RETRY_MS);
    const isReady = await evaluate(cdp, `document.querySelector('[data-part="piece"]') !== null`).catch(() => false);
    if (isReady) return;
  }
  throw new Error(`The app did not start at ${base}. Is the dev server running (npm run ui:dev)?`);
}

/** Every style's own looks: [{ style, job, kind }], read from the app's own registry. */
function listLooks(cdp) {
  return evaluate(
    cdp,
    `Promise.all([import("/src/studio/registry/jobs.ts"), import("/src/studio/skins/index.ts")]).then(([j, s]) =>
      j.JOBS.flatMap((job) => job.looks.map((kind) => ({ style: s.pieceFamily(kind), job: job.id, kind })))
        .filter((look) => look.style !== null))`,
  );
}

/** Show `look` alone on its page, centred at the size adding it gives. */
function showLook(cdp, look) {
  const page = PAGE_OF_JOB[look.job] ?? "home";
  return evaluate(
    cdp,
    `Promise.all([import("/src/studio/defaults.ts"), import("/src/studio/skins/index.ts"),
      import("/src/studio/registry/index.ts")]).then(([d, s, r]) => {
      const doc = d.defaultDoc();
      s.applySkin(doc, s.SKINS.find((skin) => skin.id === ${JSON.stringify(look.style)}));
      const size = r.pieceDef(${JSON.stringify(look.kind)})?.size ?? { w: 0.5, h: 0.5 };
      const rect = { x: (1 - size.w) / 2, y: (1 - size.h) / 2, w: size.w, h: size.h };
      doc.stages[${JSON.stringify(page)}] = [d.piece(${JSON.stringify(look.kind)}, rect, 1)];
      window.postMessage({ kind: "valoshell-preview-show", doc, page: ${JSON.stringify(page)} }, location.origin);
      return true;
    })`,
  );
}

/** The look's own faults: the nav belongs to the page around it, which the layout sweep checks. */
const isLookFault = (fault) => !fault.startsWith("nav ");

/** Faults still there a moment later; one caught mid-layout is not a fault. */
async function lastingFaults(cdp) {
  const check = async () =>
    (await evaluate(cdp, `(${findLayoutFaults.toString()})('[data-part="piece"]')`)).filter(isLookFault);
  const first = await check();
  if (first.length === 0) return first;
  await wait(RECHECK_MS);
  const again = new Set((await check()).map(normalized));
  return first.filter((fault) => again.has(normalized(fault)));
}

async function sweepLook(cdp, look) {
  for (const [width, height] of VIEWPORTS) {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await showLook(cdp, look);
    await wait(SETTLE_MS);
    for (const fault of await lastingFaults(cdp)) {
      // --raw keeps the pixels the baseline drops, to see how far off a finding is.
      if (process.argv.includes("--raw")) console.log(`    ${width}x${height} ${look.kind}: ${fault}`);
      findings.add(`${look.kind} ${normalized(fault)}`);
    }
  }
}

async function worker(index, looks) {
  const [width, height] = VIEWPORTS[0];
  const chrome = await openChrome(FIRST_PORT + index, { width, height });
  try {
    const cdp = await connect(chrome.url);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await openPreview(cdp);
    for (const look of looks) {
      await sweepLook(cdp, look);
      console.log(`  ${look.kind}`);
    }
    cdp.close();
  } finally {
    chrome.close();
  }
}

/** New findings fail the run; vanished accepted ones are reported so the baseline stays honest. */
function compareWithBaseline(swept) {
  if (process.argv.includes("--update-baseline")) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify({ accepted: [...findings].sort() }, null, 2)}\n`);
    console.log(`Baseline updated: ${findings.size} accepted findings.`);
    return 0;
  }
  const accepted = new Set(JSON.parse(readFileSync(BASELINE_PATH, "utf8")).accepted);
  const fresh = [...findings].filter((key) => !accepted.has(key));
  const gone = [...accepted].filter((key) => swept.has(key.split(" ")[0]) && !findings.has(key));
  for (const key of gone) console.log(`  fixed? ${key} (no longer seen; drop it from the baseline)`);
  for (const key of fresh) console.log(`  NEW   ${key}`);
  console.log(fresh.length === 0 ? "No new layout faults in the looks." : `${fresh.length} new layout faults.`);
  return fresh.length === 0 ? 0 : 1;
}

async function main() {
  const lister = await openChrome(FIRST_PORT - 1, { width: VIEWPORTS[0][0], height: VIEWPORTS[0][1] });
  let looks;
  try {
    const cdp = await connect(lister.url);
    await openPreview(cdp);
    looks = (await listLooks(cdp)).filter((look) => !onlyStyles || onlyStyles.includes(look.style));
    cdp.close();
  } finally {
    lister.close();
  }
  console.log(`${looks.length} looks x ${VIEWPORTS.length} sizes`);
  const groups = Array.from({ length: WORKERS }, (_, index) => looks.filter((_, at) => at % WORKERS === index));
  await Promise.all(groups.filter((group) => group.length > 0).map((group, index) => worker(index, group)));
  process.exitCode = compareWithBaseline(new Set(looks.map((look) => look.kind)));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
