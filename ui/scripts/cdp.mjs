// Headless Chrome over its DevTools protocol, for the scripts that look at the running app
// (look thumbnails, the layout sweep). Each browser gets a fresh throwaway profile.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_PATHS = {
  win32: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "google-chrome",
};
// Chrome takes a few seconds to open its debugging port.
const PORT_ATTEMPTS = 50;
const PORT_RETRY_MS = 200;
/** Pictures and checks everyone compares: the app's English text, whatever this machine uses. */
export const LOCALE = "en-US";

export const wait = (ms) => new Promise((done) => setTimeout(done, ms));

/** The fresh profile's own blank tab, so no other Chrome on the port is ever driven. */
async function blankTab(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  return targets.find((target) => target.type === "page" && target.url === "about:blank");
}

/** Start a headless Chrome on `port`; `close()` stops it and deletes its profile. */
export async function openChrome(port, size) {
  const chromePath = process.env.CHROME ?? CHROME_PATHS[process.platform] ?? CHROME_PATHS.linux;
  const profile = mkdtempSync(join(tmpdir(), "valoshell-chrome-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${size.width},${size.height}`,
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    `--lang=${LOCALE}`,
    "about:blank",
  ]);
  const close = () => {
    chrome.kill();
    // Chrome may still be writing its profile as it exits (seen on Linux runners). A temporary
    // folder left behind costs nothing, so it is reported, never allowed to fail the run.
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
    } catch (error) {
      console.warn(`chrome_profile_not_removed path=${profile} reason=${error.code ?? error.message}`);
    }
  };
  for (let attempt = 0; attempt < PORT_ATTEMPTS; attempt += 1) {
    const page = await blankTab(port).catch(() => undefined);
    if (page) return { url: page.webSocketDebuggerUrl, close };
    await wait(PORT_RETRY_MS);
  }
  close();
  throw new Error(`Chrome did not start (looked for it at ${chromePath}; set CHROME to its path).`);
}

/** A DevTools protocol session: `send(method, params)` resolves with the result, and
 *  `on(event, handler)` hears the browser's events (console errors, exceptions...). */
export function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method) {
      for (const handler of listeners.get(message.method) ?? []) handler(message.params);
      return;
    }
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  const send = (method, params = {}) =>
    new Promise((done, fail) => {
      const id = nextId++;
      pending.set(id, { resolve: done, reject: fail });
      socket.send(JSON.stringify({ id, method, params }));
    });
  return new Promise((done, fail) => {
    const on = (event, handler) => listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    socket.addEventListener("open", () => done({ send, on, close: () => socket.close() }));
    socket.addEventListener("error", () => fail(new Error("Could not talk to Chrome.")));
  });
}

/** Evaluate `expression` in the page and return its value; a thrown error fails the run. */
export async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

/** An app module as the page itself loaded it (Vite adds ?t= to edited files), so an import
 *  shares the page's state instead of starting a second copy. */
export function loadedModule(path) {
  return `(performance.getEntriesByType("resource").map((entry) => entry.name).find((name) => name.includes(${JSON.stringify(path)})) ?? ${JSON.stringify(path)})`;
}
