<p align="center"><img src="icons/icon128.png" width="64" alt="FavFontz logo"></p>

<h1 align="center">FavFontz</h1>

<p align="center">Save your favorite Google Fonts and keep them in one list.</p>

<!-- Add a screenshot: save it as docs/screenshot.png and uncomment the line below -->
<!-- <p align="center"><img src="docs/screenshot.png" width="420" alt="FavFontz popup"></p> -->

## Features

- **Save from the page:** a Save button sits next to "Get font" on every Google Fonts specimen page.
- **Search or add from the popup:** autocomplete across the whole Google Fonts catalog.
- **Live previews:** each favorite is rendered in its own typeface.
- **Copy embed code:** grab a `<link>` tag or `font-family` rule per font, or one `<link>` for all favorites.
- **Syncs across computers:** favorites are stored with Chrome sync.
- Light and dark mode.

## Install

FavFontz isn't on the Chrome Web Store yet, so load it unpacked:

1. Clone or download this repo.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the project folder.

To update, pull the latest changes and click the reload icon on the extension's card.

## Syncing between computers

Favorites live in `chrome.storage.sync`, so they follow your Google account. On each computer:

- Be signed into Chrome with sync turned on, including **Extensions** under *Settings → You and Google → Sync*.
- Load the extension from this repo.

The `key` in `manifest.json` pins the extension ID to `enaepanjoooieknocpalamhkipkocnno`, so every copy is treated as the same extension (and shares the same favorites), whatever folder it's loaded from.

## Project structure

```
manifest.json   Extension config
content.js      The Save button on fonts.google.com
popup.html      Popup markup
popup.css       Popup styles
popup.js        Popup logic: list, search, autocomplete, copy
icons/          Toolbar and store icons, plus the source logo.svg
```

## Permissions

| Permission | Why |
| --- | --- |
| `storage` | Save your favorites (synced) and cache the font catalog (local). |
| `fonts.google.com` | Show the Save button and fetch the font catalog for autocomplete. |
| `fonts.googleapis.com` | Load font previews in the popup. |

No analytics, no tracking, no external servers besides Google Fonts.

## License

[MIT](LICENSE)
