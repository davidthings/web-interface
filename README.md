# Web Serial Console (Next.js + Preact)

A minimal, dark-mode, client-only serial console for the browser using the Web Serial API. Built with Next.js (Pages Router) and Preact via `preact/compat`. Designed for static export and deployment to GitHub Pages.

## Features

- **Console**: scrolling output, capped buffer (~10k lines), timestamps toggle, auto-scroll toggle, clear, download log
- **Input**: single-line input, send on Enter (configurable EOL: LF/CR/CRLF)
- **Connection**: pick a serial device, set baud rate, connect/disconnect
- **Status**: connection status badge and error surfacing
- **Persistence**: remembers baud, EOL, timestamps, auto-scroll in `localStorage`
- **Fallback**: Mock transport when Web Serial is unavailable (for demo/testing)

## Tech Stack

- **Next.js** (Pages Router), JavaScript-only
- **Preact** via alias: `react` and `react-dom` → `preact/compat`
- **Plain CSS** with CSS variables for a minimal modern dark theme
- **Static export** for GitHub Pages (`next export`)

## Architecture

- `pages/index.js` — client-only app composition (ConnectionPanel + Console + InputBar)
- `components/ConnectionPanel.js` — baud, EOL, connect/disconnect, status, errors
- `components/Console.js` — output area + toolbar (timestamps, auto-scroll, clear, download)
- `components/InputBar.js` — text input, Enter to send
- `lib/serial/SerialClient.js` — framework-agnostic facade that emits events and wraps transports
- `lib/serial/WebSerialTransport.js` — Web Serial implementation
- `lib/serial/MockTransport.js` — mock implementation (echo + periodic messages)
- `lib/serial/LineCodec.js` — EOL splitting/buffering
- `lib/serial/constants.js` — defaults: `DEFAULT_BAUD=115200`, `DEFAULT_EOL='\n'`, `EOL_OPTIONS`
- `lib/serial/utils.js` — helpers (support check, emitter, timestamp formatting)
- `styles/globals.css` — dark theme and minimal control styling
- `next.config.js` — Preact alias, static export, dynamic `basePath`/`assetPrefix`
- `.github/workflows/deploy.yml` — GitHub Pages deployment workflow

### Serial core design

`createSerialClient(opts)` returns an object with:
- `connect({ baudRate })`, `disconnect()`
- `write(text)`, `writeLine(text)` — appends configured EOL for `writeLine`
- `setSettings(patch)` — e.g. `{ eol: '\n' | '\r' | '\r\n' }`
- `getSettings()`, `getStatus()`, `getMode()`
- `on(type, handler)`, `off(type, handler)` — events: `status`, `line`, `error`, `settings`

Internals:
- Transport is chosen at runtime: `webserial` if `navigator.serial` exists, otherwise `mock`
- `WebSerialTransport` listens for `navigator.serial` `disconnect` events and surfaces them
- `LineCodec` buffers raw chunks → splits into lines by selected EOL and forwards to client as `line` events

## Prerequisites

- Node.js >= 18.17 (recommended: Node 20 LTS)
  - Preact/Next integration and Next 14 require modern Node. If you see an engine warning, upgrade Node.
- A Chromium-based browser (Chrome, Edge) over HTTPS for Web Serial access

Using `nvm` to install and use Node 20:
```bash
nvm install 20
nvm use 20
node -v
```

## Install

```bash
npm install
```

## Run (development)

```bash
npm run dev
# open http://localhost:3000/
```

## Build static export

```bash
npm run build:static
# output in ./out
```

Quickly preview the export locally:
```bash
npx serve out
```

## Deploy to GitHub Pages

This repo includes a GitHub Actions workflow: `.github/workflows/deploy.yml`.

- On push to `main`, it will build and export the site, then publish `out/` to GitHub Pages.
- Ensure repo Settings → Pages → Build and deployment → Source = GitHub Actions.
- Site URL (project page): `https://<username>.github.io/web-interface/`

### Base path

Static export is configured with dynamic `basePath`/`assetPrefix` in `next.config.js`:
- Dev: no base path, runs at `/`
- Production: `basePath='/web-interface'`, `assetPrefix='/web-interface/'`
If you rename the repo, update `repoBase` accordingly.

## Browser Support and Permissions

- Web Serial is supported on Chromium-based browsers. It requires HTTPS and a user gesture to request a port.
- If unsupported, the app switches to Mock mode and continues to function for demo/testing.
- Disconnects are detected and surfaced to the UI with a status update and error message.

## Troubleshooting

- "Unsupported engine" or Next.js failing to run: upgrade Node to >= 18.17 (prefer Node 20) via `nvm install 20 && nvm use 20`.
- No devices shown / prompt doesn’t appear: Make sure you’re in a supported browser and served over HTTPS (or `localhost` during dev).
- Empty output: Verify baud rate matches your device and that EOL matches your device’s line endings when sending.

## License

MIT
