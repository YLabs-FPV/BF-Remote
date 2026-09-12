import { CODE_ALPHABET, CODE_LENGTH, isValidCode } from "@bf-remote/shared";

const ALLOWED_HOST = /^(localhost|127\.0\.0\.1|([a-z0-9-]+\.)*yarosfpv\.com)$/i;
const PARTIAL_RE = new RegExp(`^[${CODE_ALPHABET}]{1,${CODE_LENGTH - 1}}$`);

export function wsBase(): string {
  const secure = location.protocol === "https:";
  return `${secure ? "wss" : "ws"}://${location.host}`;
}

export function shareUrl(code: string): string {
  return `${wsBase()}/ws/${code}`;
}

export function normalizeCode(input: string): string {
  return input.replace(/[^0-9a-z]/gi, "").toLowerCase();
}

export function formatCode(code: string): string {
  const up = code.toUpperCase();
  const mid = Math.ceil(up.length / 2);
  return `${up.slice(0, mid)}-${up.slice(mid)}`;
}

/** True while the input is a plausible in-progress code, so we don't flash an error. */
export function isPartialCode(input: string): boolean {
  if (input.includes("://")) return false;
  return PARTIAL_RE.test(normalizeCode(input));
}

/**
 * Turns Help-card input into a connectable link + its code, or null if invalid.
 * A bare code becomes a link; a full ws(s):// link to an allowed host is passed
 * through unchanged; anything else is rejected.
 */
export function resolveInput(input: string): { url: string; code: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.includes("://")) {
    let u: URL;
    try {
      u = new URL(trimmed);
    } catch {
      return null;
    }
    if (u.protocol !== "ws:" && u.protocol !== "wss:") return null;
    if (!ALLOWED_HOST.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/ws\/([0-9a-z]+)$/i);
    if (!m) return null;
    const code = m[1].toLowerCase();
    return isValidCode(code) ? { url: trimmed, code } : null;
  }

  const code = normalizeCode(trimmed);
  return isValidCode(code) ? { url: shareUrl(code), code } : null;
}
