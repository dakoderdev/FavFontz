// "Save" button on Google Fonts specimen pages (fonts.google.com/specimen/Font+Name).
// Sits inline, just left of Google's own "Get font" button.
(() => {
  const HEART = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.9 3.8 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.5 0 5.7 3.4 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3z"/></svg>`;

  const STYLE = `
    :host { all: initial; display: inline-flex; flex: none; color: inherit; }
    button {
      display: inline-flex; align-items: center; gap: 8px; height: var(--ff-h, 40px); padding: 0 20px 0 16px;
      font-family: var(--ff-family, "Google Sans Flex", "Google Sans Text", system-ui, sans-serif);
      /* Light-on-dark text looks heavier than it is, so the outlined state sits a bit lighter */
      font-weight: calc(var(--ff-weight, 500) - 50); font-size: var(--ff-size, 14px); font-stretch: var(--ff-stretch, 100%);
      letter-spacing: var(--ff-tracking, normal); line-height: 1;
      font-variation-settings: var(--ff-variation, normal); font-feature-settings: var(--ff-features, normal);
      font-optical-sizing: var(--ff-optical, auto); color: inherit; background: transparent;
      border: 1px solid color-mix(in srgb, currentColor 28%, transparent); border-radius: 999px;
      cursor: pointer; white-space: nowrap; -webkit-font-smoothing: antialiased;
      transition: background .15s, border-color .15s, transform .15s;
    }
    button:hover { background: color-mix(in srgb, currentColor 6%, transparent); border-color: color-mix(in srgb, currentColor 45%, transparent); }
    button:active { transform: scale(.97); }
    button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
    button.saved, button.saved:hover {
      background: #ededed; color: #3e3e3e; border-color: #ededed;
      font-weight: var(--ff-weight, 500); /* dark-on-light: full weight */
    }
    button.saved svg { fill: currentColor; }
    button.pop svg { animation: pop .3s ease-out; }
    @keyframes pop { 50% { transform: scale(1.25); } }

    @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
  `;

  let host = null, btn = null, label = null, last = null;

  function currentFont() {
    const m = location.pathname.match(/^\/specimen\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  }

  async function getFavs() {
    const { favorites = [] } = await chrome.storage.sync.get("favorites");
    return favorites;
  }

  // Google's "Get font" button (its label flips to "Remove font" once added to the bag)
  // Matches loosely: icon fonts put words like "download" into the button's text.
  const LABEL_RE = /\b(get|remove) font\b/i;
  function findAnchor() {
    const matches = [...document.querySelectorAll("button, [role=button], a")].filter(el => {
      if (el === host || !el.getClientRects().length) return false;
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      return (text.length < 40 && LABEL_RE.test(text)) || LABEL_RE.test(el.getAttribute("aria-label") || "");
    });
    // Prefer the innermost match (e.g. a <button> inside a matching <a>)
    return matches.find(el => !matches.some(o => o !== el && el.contains(o))) || null;
  }

  function create() {
    host = document.createElement("span");
    host.id = "font-favorites-root";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `<style>${STYLE}</style><button type="button">${HEART}<span class="label"></span></button>`;
    btn = root.querySelector("button");
    label = root.querySelector(".label");
    btn.addEventListener("click", e => { e.stopPropagation(); toggle(); });
  }

  // Put the button just left of "Get font", on the same row (re-run whenever the page re-renders)
  function place() {
    if (!currentFont()) { host?.remove(); return; }
    if (!host) { create(); render(); }
    if (host.isConnected && host.nextElementSibling?.getClientRects().length) return;
    const anchor = findAnchor();
    if (!anchor) return;
    if (host.nextElementSibling !== anchor) anchor.before(host);
    // The wrapper around "Get font" stacks its children; lay it out as a row instead
    Object.assign(anchor.parentElement.style, { display: "flex", flexDirection: "row", alignItems: "center", gap: "8px" });
    host.style.setProperty("--ff-h", `${anchor.getBoundingClientRect().height || 40}px`);
    // Match the "Get font" button's typography exactly (only our button is affected)
    const cs = getComputedStyle(anchor);
    const vars = {
      "--ff-family": cs.fontFamily, "--ff-weight": cs.fontWeight, "--ff-size": cs.fontSize,
      "--ff-stretch": cs.fontStretch, "--ff-tracking": cs.letterSpacing,
      // Google Sans Flex variable axes, e.g. "ROND" (roundness)
      "--ff-variation": cs.fontVariationSettings, "--ff-features": cs.fontFeatureSettings,
      "--ff-optical": cs.fontOpticalSizing
    };
    for (const [k, v] of Object.entries(vars)) if (v) host.style.setProperty(k, v);
  }

  async function render() {
    const font = currentFont();
    if (!font || !btn) return;
    let saved;
    try { saved = (await getFavs()).some(f => f.name === font); }
    catch { host.remove(); observer.disconnect(); return; } // extension was reloaded; this script is orphaned
    btn.classList.toggle("pop", last !== null && last !== saved && saved);
    last = saved;
    btn.classList.toggle("saved", saved);
    label.textContent = saved ? "Saved" : "Save";
    btn.title = saved ? `Remove ${font} from favorites` : `Save ${font} to favorites`;
    btn.setAttribute("aria-pressed", String(saved));
  }

  async function toggle() {
    const font = currentFont();
    if (!font) return;
    let favs = await getFavs();
    favs = favs.some(f => f.name === font)
      ? favs.filter(f => f.name !== font)
      : [{ name: font, added: Date.now() }, ...favs];
    await chrome.storage.sync.set({ favorites: favs });
  }

  // The page is a single-page app that re-renders often: re-place on DOM changes (batched per frame)
  let queued = false, lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (location.href !== lastUrl) { lastUrl = location.href; last = null; render(); }
      place();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.storage.onChanged.addListener((changes, area) => { if (area === "sync" && changes.favorites) render(); });
  place();
})();
