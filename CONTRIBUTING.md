# Contributing to BF-Remote

Thanks for your interest - contributions are welcome, whether that's code, docs,
or reporting how BF-Remote behaves with your flight controller.

## Ways to help

- **Report a bug** - especially anything around the Web Serial bridge, the relay,
  or reconnect behaviour.
- **Suggest a feature** with an issue.
- **Improve the docs or code** with a pull request (see below).

## The golden rule: test with a real flight controller

BF-Remote moves live MSP traffic between a real FC and a real Betaflight
Configurator, and some issues only show up on actual hardware - USB unplug,
reconnect, two Configurators, CLI mode. **Any change to the bridge or relay
behaviour must be tested end to end with a real flight controller before it's
merged.** In your pull request, say what you connected and what you verified.

**AI-assisted contributions are welcome** - use whatever tools help you. The same
rule applies: if it changes how the bridge or relay behaves, you must have run it
against a real FC and confirmed it works. Untested, "looks correct" changes will be
asked to prove themselves first.

Docs-only or styling-only changes don't need a flight controller - just make sure
it builds (`pnpm build`) and type-checks (`pnpm typecheck`).

## Development setup

A single [pnpm](https://pnpm.io) workspace; tooling pinned with
[mise](https://mise.jdx.dev).

```bash
mise install      # provision Node + pnpm
pnpm install      # install workspace deps

mise run dev      # front-end (:5173) + relay (:8787), proxied
mise run web      # front-end only
mise run server   # relay only
```

Open http://localhost:5173. Sharing needs Chrome or Edge (the Web Serial API).

## Pull request checklist

- [ ] Bridge/relay behaviour changes are **tested with a real flight controller**
      (state what you connected and what you verified).
- [ ] `pnpm typecheck` and `pnpm build` pass.
- [ ] Code follows the style of the surrounding files.
- [ ] Commits are focused and the PR description explains the "why".

## Reporting security issues

BF-Remote hands a helper full MSP control of a flight controller, so security
matters. Please don't open a public issue for anything security-sensitive - contact
the maintainer privately first (yaros@yarosfpv.com).

## License

By contributing, you agree that your contributions are licensed under the project's
[GPL-3.0-or-later](LICENSE) license.
