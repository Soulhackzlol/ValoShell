// The layout checks the sweep runs inside the page. `findLayoutFaults` is sent to the browser
// as source (its `toString()`), so it must stay self-contained: everything it needs is
// declared inside it.

/** Every layout fault on the screen now, as short readable lines. Tiny text is looked for under
 *  `textRoot` (the whole scene by default; the look sweep narrows it to the piece it checks). */
export function findLayoutFaults(textRoot = '[data-part="scene"]') {
  // Smaller than this is unreadable on a 1080p screen at 100 %.
  const MIN_TEXT_PX = 9.5;
  // Tolerances for rounding and hairline borders.
  const NAV_OVERLAP_PX = 3;
  const SPILL_PX = 6;
  const CLIP_PX = 4;
  // Text boxes overlapping by this share of the smaller one read as drawn over each other.
  const OVERLAP_SHARE = 0.4;
  const MAX_TEXT_BOXES = 160;

  const isVisible = (element) => {
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.05;
  };
  const labelOf = (element) => String(element.getAttribute("data-kind") || element.getAttribute("data-part") || element.className || element.tagName).slice(0, 40);
  const textOf = (element, max) => (element.textContent.trim() || element.title || "").slice(0, max);
  const hasOwnText = (element, min = 1) => [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim().length >= min);
  const overlap = (a, b) => ({
    x: Math.min(a.right, b.right) - Math.max(a.left, b.left),
    y: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
  });

  /** Nav buttons on top of each other or off the screen's edge. */
  function navFaults() {
    const nav = document.querySelector('[data-part="nav"]');
    if (!nav) return [];
    const boxes = [...nav.querySelectorAll("a, button")].filter(isVisible).map((el) => [el, el.getBoundingClientRect()]).filter(([, r]) => r.width > 0);
    const faults = [];
    boxes.forEach(([a, ra], i) => {
      if (ra.right > innerWidth + 1 || ra.left < -1) faults.push(`nav offscreen: ${textOf(a, 20)}`);
      for (const [b, rb] of boxes.slice(i + 1)) {
        const area = overlap(ra, rb);
        if (!a.contains(b) && !b.contains(a) && area.x > NAV_OVERLAP_PX && area.y > NAV_OVERLAP_PX) faults.push(`nav overlap: ${textOf(a, 16)} / ${textOf(b, 16)}`);
      }
    });
    return faults;
  }

  /** Inside a scrolling or clipping box, an element cannot spill out of its piece. */
  function isContained(element, piece) {
    for (let up = element.parentElement; up && up !== piece; up = up.parentElement) {
      if (getComputedStyle(up).overflow !== "visible") return true;
    }
    return false;
  }

  /** The furthest any text runs past the piece's edges (art and glows may bleed on purpose). */
  function spillFault(piece, box) {
    let worst = 0;
    let culprit = null;
    for (const el of piece.querySelectorAll("*")) {
      if (!isVisible(el) || !hasOwnText(el) || getComputedStyle(el).position === "fixed" || isContained(el, piece)) continue;
      const r = el.getBoundingClientRect();
      const over = Math.max(r.right - box.right, box.left - r.left, r.bottom - box.bottom, box.top - r.top);
      if (r.width > 0 && over > worst) [worst, culprit] = [over, el];
    }
    return worst > SPILL_PX ? `spill ${Math.round(worst)}px: ${labelOf(piece)} > ${textOf(culprit, 24)}` : null;
  }

  /** The part of `element` its scrolling or clipping ancestors (up to the piece) let show; a
   *  row scrolled out of its list is not on screen and cannot cover anything. */
  function shownRect(element, piece) {
    const r = element.getBoundingClientRect();
    let [left, top, right, bottom] = [r.left, r.top, r.right, r.bottom];
    for (let up = element.parentElement; up && up !== piece; up = up.parentElement) {
      if (getComputedStyle(up).overflow === "visible") continue;
      const clip = up.getBoundingClientRect();
      [left, top, right, bottom] = [Math.max(left, clip.left), Math.max(top, clip.top), Math.min(right, clip.right), Math.min(bottom, clip.bottom)];
    }
    return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  }

  /** Two readable texts drawn over each other: a layout that collapsed. Text hidden from
   *  assistive tech is decoration (Minecraft's splash) and may sit over anything. */
  function overlapFault(piece) {
    const boxes = [...piece.querySelectorAll("*")]
      .filter((el) => isVisible(el) && hasOwnText(el, 3) && Number(getComputedStyle(el).opacity) > 0.5 && !el.closest('[aria-hidden="true"]'))
      .slice(0, MAX_TEXT_BOXES)
      .map((el) => [el, shownRect(el, piece)])
      .filter(([, r]) => r.width > 4 && r.height > 4);
    for (const [i, [a, ra]] of boxes.entries()) {
      for (const [b, rb] of boxes.slice(i + 1)) {
        const area = overlap(ra, rb);
        const smaller = Math.min(ra.width * ra.height, rb.width * rb.height);
        if (!a.contains(b) && !b.contains(a) && area.x > 0 && area.y > 0 && area.x * area.y > OVERLAP_SHARE * smaller) {
          return `text overlap: ${labelOf(piece)} > ${textOf(a, 14)} / ${textOf(b, 14)}`;
        }
      }
    }
    return null;
  }

  /** Text cut off by a box that hides its overflow (ellipsis is a deliberate cut). */
  function clippedFault(piece) {
    for (const el of piece.querySelectorAll("*")) {
      const style = getComputedStyle(el);
      if (!isVisible(el) || style.textOverflow === "ellipsis" || !["hidden", "clip"].includes(style.overflowY)) continue;
      if (el.clientHeight > 0 && el.scrollHeight > el.clientHeight + CLIP_PX && el.textContent.trim()) {
        return `clipped ${el.scrollHeight - el.clientHeight}px: ${labelOf(piece)} > ${labelOf(el)}`;
      }
    }
    return null;
  }

  function pieceFaults() {
    return [...document.querySelectorAll('[data-part="piece"]')].filter(isVisible).flatMap((piece) => {
      const box = piece.getBoundingClientRect();
      if (box.width < 2) return [];
      return [overlapFault(piece), spillFault(piece, box), clippedFault(piece)].filter(Boolean);
    });
  }

  function tinyTextFaults() {
    const walker = document.createTreeWalker(document.querySelector(textRoot) || document.body, NodeFilter.SHOW_TEXT);
    let count = 0;
    let sample = "";
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      if (!walker.currentNode.textContent.trim() || !el || !isVisible(el) || el.getBoundingClientRect().width === 0) continue;
      const size = parseFloat(getComputedStyle(el).fontSize) * (el.currentCSSZoom || 1);
      if (size >= MIN_TEXT_PX) continue;
      count += 1;
      sample ||= `${walker.currentNode.textContent.trim().slice(0, 20)} (${size.toFixed(1)}px)`;
    }
    return count > 0 ? [`tiny text x${count}: ${sample}`] : [];
  }

  return [...new Set([...navFaults(), ...pieceFaults(), ...tinyTextFaults()])];
}
