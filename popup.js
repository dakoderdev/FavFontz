const $ = id => document.getElementById(id);
const list = $("list"), toast = $("toast"), input = $("addInput"), hint = $("hint");

const PREVIEW = "The quick brown fox jumps over the lazy dog";
const fam = name => name.trim().replace(/ /g, "+");
const cssUrl = name => `https://fonts.googleapis.com/css2?family=${fam(name)}&display=swap`;
const specimenUrl = name => `https://fonts.google.com/specimen/${fam(name)}`;

// Google Fonts category -> CSS generic fallback
const GENERIC = { "Serif": "serif", "Sans Serif": "sans-serif", "Monospace": "monospace", "Handwriting": "cursive", "Display": "sans-serif" };
const LABEL = { "Serif": "serif", "Sans Serif": "sans", "Monospace": "mono", "Handwriting": "script", "Display": "display" };

let favs = [];
let catalog = null;          // [{ name, cat, lc }] sorted by popularity
let byName = new Map();      // lowercased name -> catalog entry
let suggestions = [];
let active = -1;
let busy = false;

const info = name => byName.get(name.toLowerCase());
const generic = name => GENERIC[info(name)?.cat] || "sans-serif";

/* ---------- storage ---------- */

async function getFavs() {
  const { favorites = [] } = await chrome.storage.sync.get("favorites");
  return favorites;
}
async function setFavs(next) {
  favs = next;
  render();
  try { await chrome.storage.sync.set({ favorites: next }); }
  catch (e) { showToast("Couldn't save — sync storage is full", { error: true }); favs = await getFavs(); render(); }
}

// Keep in sync when you save a font from the page while the popup is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !changes.favorites) return;
  const next = changes.favorites.newValue || [];
  if (JSON.stringify(next) !== JSON.stringify(favs)) { favs = next; render(); }
});

/* ---------- Google Fonts catalog (for autocomplete, correct casing, categories) ---------- */

const WEEK = 7 * 864e5;
function setCatalog(fonts) {
  catalog = fonts.map(([name, cat]) => ({ name, cat, lc: name.toLowerCase() }));
  byName = new Map(catalog.map(f => [f.lc, f]));
  render();
}
async function loadCatalog() {
  const { catalog: cached } = await chrome.storage.local.get("catalog");
  if (cached?.fonts?.length) setCatalog(cached.fonts);
  if (cached && Date.now() - cached.t < WEEK) return;
  try {
    const res = await fetch("https://fonts.google.com/metadata/fonts");
    const data = JSON.parse((await res.text()).replace(/^\)\]\}'\s*/, ""));
    const fonts = (data.familyMetadataList || [])
      .sort((a, b) => (a.popularity ?? 1e9) - (b.popularity ?? 1e9))
      .map(f => [f.family, f.category]);
    if (!fonts.length) return;
    await chrome.storage.local.set({ catalog: { t: Date.now(), fonts } });
    setCatalog(fonts);
  } catch { /* offline or format changed: fall back to checking names directly */ }
}

function findSuggestions(q) {
  if (!catalog || !q) return [];
  const saved = new Set(favs.map(f => f.name.toLowerCase()));
  const starts = [], words = [], contains = [];
  for (const f of catalog) {
    if (saved.has(f.lc)) continue;
    const i = f.lc.indexOf(q);
    if (i === 0) starts.push(f);
    else if (i > 0 && f.lc[i - 1] === " ") words.push(f);
    else if (i > 0) contains.push(f);
    if (starts.length >= 6) break;
  }
  return [...starts, ...words, ...contains].slice(0, 6);
}

// Fallback when the catalog isn't available: probe the CSS API
async function resolveFont(name) {
  const titled = name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  for (const c of new Set([name, titled])) {
    try { if ((await fetch(cssUrl(c))).ok) return c; } catch {}
  }
  return null;
}

/* ---------- toast ---------- */

let toastTimer;
function showToast(msg, { action, onAction, error } = {}) {
  clearTimeout(toastTimer);
  toast.replaceChildren();
  toast.classList.toggle("error", !!error);
  const span = document.createElement("span");
  span.textContent = msg;
  toast.append(span);
  if (action) {
    const b = document.createElement("button");
    b.textContent = action;
    b.onclick = () => { onAction(); toast.classList.remove("show"); };
    toast.append(b);
  }
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), action ? 5000 : 1800);
}

async function copy(text, what) {
  try { await navigator.clipboard.writeText(text); showToast(`Copied ${what}`); }
  catch { showToast("Couldn't copy — try again", { error: true }); }
}

/* ---------- rendering ---------- */

const loaded = new Set();
function loadFont(name) {
  if (loaded.has(name)) return;
  loaded.add(name);
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = cssUrl(name);
  document.head.append(l);
}

function el(tag, props = {}, ...kids) {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
}

function favRow(f) {
  loadFont(f.name);
  const cat = LABEL[info(f.name)?.cat];
  const preview = el("div", { className: "preview", textContent: PREVIEW });
  preview.style.fontFamily = `'${f.name}', ${generic(f.name)}`;
  return el("li", { className: "fav" },
    el("div", { className: "row" },
      el("button", { className: "name", textContent: f.name, title: "Open on Google Fonts", onclick: () => chrome.tabs.create({ url: specimenUrl(f.name) }) }),
      cat ? el("span", { className: "cat", textContent: cat }) : "",
      el("div", { className: "actions" },
        el("button", { className: "act", textContent: "<link>", title: "Copy the <link> tag for your <head>",
          onclick: () => copy(`<link href="${cssUrl(f.name)}" rel="stylesheet">`, "link tag") }),
        el("button", { className: "act", textContent: "css", title: "Copy the font-family rule",
          onclick: () => copy(`font-family: '${f.name}', ${generic(f.name)};`, "CSS") }),
        el("button", { className: "act del", textContent: "×", title: "Remove", ariaLabel: `Remove ${f.name}`, onclick: () => remove(f.name) }),
      ),
    ),
    preview,
  );
}

function suggRow(f, i, q) {
  const at = f.lc.indexOf(q);
  const b = el("button", { className: "sugg" + (i === active ? " active" : ""), type: "button", role: "option", id: `s${i}` },
    el("span", { className: "n" }, f.name.slice(0, at), el("mark", { textContent: f.name.slice(at, at + q.length) }), f.name.slice(at + q.length)),
    el("span", { className: "cat", textContent: LABEL[f.cat] || "" }),
    el("span", { className: "plus", textContent: "+ add" }),
  );
  b.ariaSelected = String(i === active);
  b.onmouseenter = () => { active = i; paintActive(); };
  b.onclick = () => add(f.name);
  return b;
}

function paintActive() {
  list.querySelectorAll(".sugg").forEach((b, i) => {
    b.classList.toggle("active", i === active);
    b.ariaSelected = String(i === active);
    if (i === active) b.scrollIntoView({ block: "nearest" });
  });
  input.setAttribute("aria-activedescendant", active >= 0 ? `s${active}` : "");
  updateHint();
}

function updateHint() {
  const q = input.value.trim();
  hint.className = "kbd" + (busy ? " busy" : "");
  hint.textContent = busy ? "…" : (q && (active >= 0 || !catalog)) ? "↵ add" : q ? "esc" : "";
  hint.hidden = !hint.textContent;
}

function render() {
  const q = input.value.trim().toLowerCase();
  const shown = q ? favs.filter(f => f.name.toLowerCase().includes(q)) : favs;
  suggestions = findSuggestions(q);
  const exactFav = favs.some(f => f.name.toLowerCase() === q);
  if (active >= suggestions.length || active < 0) active = suggestions.length && !exactFav ? 0 : -1;

  $("count").textContent = favs.length || "";
  $("footer").hidden = !favs.length;
  $("footCount").textContent = `${favs.length} saved`;
  input.setAttribute("aria-expanded", String(suggestions.length > 0));

  const out = [];
  if (!favs.length && !q) {
    const link = el("a", { href: "#", textContent: "fonts.google.com" });
    link.onclick = e => { e.preventDefault(); chrome.tabs.create({ url: "https://fonts.google.com" }); };
    out.push(el("div", { className: "empty" },
      el("strong", { textContent: "No favorites yet" }),
      "Hit Save on any font at ", link, ", or search above."));
  }
  if (shown.length) {
    if (q && suggestions.length) out.push(el("div", { className: "section", textContent: "Saved" }));
    out.push(el("ul", {}, ...shown.map(favRow)));
  }
  if (suggestions.length) {
    out.push(el("div", { className: "section", textContent: "Add from Google Fonts" }));
    out.push(el("div", { role: "listbox" }, ...suggestions.map((f, i) => suggRow(f, i, q))));
  }
  if (q && !shown.length && !suggestions.length) {
    out.push(el("div", { className: "empty" }, catalog
      ? `No fonts match “${input.value.trim()}”.`
      : `Press ↵ to look up “${input.value.trim()}” on Google Fonts.`));
  }
  list.replaceChildren(...out);
  paintActive();
}

/* ---------- actions ---------- */

async function add(name) {
  if (favs.some(f => f.name.toLowerCase() === name.toLowerCase())) return showToast(`${name} is already saved`);
  input.value = "";
  active = -1;
  await setFavs([{ name, added: Date.now() }, ...favs]);
  showToast(`Added ${name}`);
  input.focus();
}

async function remove(name) {
  const before = favs;
  await setFavs(favs.filter(x => x.name !== name));
  showToast(`Removed ${name}`, { action: "Undo", onAction: () => setFavs(before) });
}

input.addEventListener("input", () => { active = -1; render(); });

input.addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (!suggestions.length) return;
    e.preventDefault();
    const n = suggestions.length, d = e.key === "ArrowDown" ? 1 : -1;
    active = active < 0 ? (d > 0 ? 0 : n - 1) : (active + d + n) % n;
    paintActive();
  } else if (e.key === "Escape" && input.value) {
    e.preventDefault();
    input.value = "";
    active = -1;
    render();
  }
});

$("addForm").addEventListener("submit", async e => {
  e.preventDefault();
  const raw = input.value.trim().replace(/\s+/g, " ");
  if (!raw || busy) return;
  if (active >= 0 && suggestions[active]) return add(suggestions[active].name);
  const known = info(raw);
  if (known) return add(known.name);
  if (favs.some(f => f.name.toLowerCase() === raw.toLowerCase())) return showToast(`${raw} is already saved`);
  if (catalog) return showToast(`Couldn't find “${raw}” on Google Fonts`, { error: true });

  busy = true; updateHint();
  const name = await resolveFont(raw);
  busy = false; updateHint();
  if (name) add(name);
  else showToast(`Couldn't find “${raw}” on Google Fonts`, { error: true });
});

$("copyAll").addEventListener("click", () => {
  const families = favs.map(f => `family=${fam(f.name)}`).join("&");
  copy(`<link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">`, `embed for ${favs.length} fonts`);
});

/* ---------- init ---------- */

(async () => {
  favs = await getFavs();
  render();
  input.focus();
  loadCatalog();
})();
