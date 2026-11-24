// Where the UI runs: inside the Tauri shell, or in a plain browser (demo backend).

/** The look gallery's live preview frame (`?look-preview`): the app drawn with demo data and
 * the look the gallery hands it. It never reaches the real backend, saves, or plays sound. */
export const isLookPreview =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("look-preview");

/** True inside the desktop app; false in a browser tab (dev preview, demo) and in a preview frame. */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window && !isLookPreview;
