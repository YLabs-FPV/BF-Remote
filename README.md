<div align="center">

<img src="web/public/icon.svg" alt="BF-Remote" width="96" height="96" />

# BF-Remote

**Your quad, configured from anywhere. Their Betaflight, connected.**

Remote Betaflight help over the web - like TeamViewer, but for a flight
controller. Plug your FC into the browser, share a code, and a helper configures
your quad from anywhere using the official Betaflight Configurator.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-2563eb.svg?style=flat-square)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Betaflight](https://img.shields.io/badge/Betaflight-Configurator-32c766?style=flat-square)](https://app.betaflight.com)
[![Built with Svelte](https://img.shields.io/badge/built%20with-Svelte-ff3e00?style=flat-square&logo=svelte&logoColor=white)](https://svelte.dev)

[**🌐 Open the app**](https://remote.yarosfpv.com)

</div>

---

## What it does

BF-Remote bridges your flight controller's MSP connection to a helper's Betaflight
Configurator, so someone you trust can tune or diagnose your quad from anywhere:

- **You share.** Open the page in Chrome or Edge, pick your flight controller, and
  get a short code. Your FC is bridged to the relay over the Web Serial API.
- **They connect.** Your helper drops `wss://remote.yarosfpv.com/ws/<code>` into
  Betaflight Configurator's _Manual_ connection - no install, no fork.

Both sides dial _out_ to the relay, so it works behind any NAT with no port
forwarding. Only one Configurator talks to the FC at a time - MSP is a
single-master protocol, so the relay never lets two masters interleave.

## What you need

- **To share:** Chrome or Edge on desktop (for the Web Serial API) and a flight
  controller.
- **To help:** the official [Betaflight Configurator](https://app.betaflight.com) -
  any browser or the desktop app.
- **To self-host:** a Cloudflare account. The relay runs on the Workers **free**
  plan (Durable Objects on the SQLite backend).

## Getting started

Just open [remote.yarosfpv.com](https://remote.yarosfpv.com) - nothing to install.
Share your quad, or paste a code to help someone.

## Development

BF-Remote is a single [pnpm](https://pnpm.io) workspace that ships in one
`wrangler deploy`. Tooling is pinned with [mise](https://mise.jdx.dev).

```bash
mise install      # provision Node + pnpm
pnpm install      # install workspace deps

mise run dev      # front-end (:5173) + relay (:8787), proxied
pnpm typecheck    # shared → server → web
pnpm deploy       # build the front-end, then wrangler deploy
```

Planning to contribute? See [CONTRIBUTING.md](CONTRIBUTING.md).

## Repository layout

| Path      | What's inside                                              |
| --------- | ---------------------------------------------------------- |
| `server/` | Cloudflare Worker + Durable Object - the WebSocket relay.  |
| `web/`    | Vite + Svelte front-end (the share page and helper page).  |
| `shared/` | Wire-protocol types and code helpers used by both.         |

## License

BF-Remote is free software, licensed under the **GNU General Public License v3.0
or later**. See [`LICENSE`](LICENSE) for the full text.

Copyright © 2026 YarosFPV
