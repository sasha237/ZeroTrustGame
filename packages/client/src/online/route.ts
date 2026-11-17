/** Minimal hash router — no dependency. Routes: home, `#/observe/<token>`, `#/reset/<token>`. */
export type HashRoute = { kind: 'home' } | { kind: 'observe'; token: string } | { kind: 'reset'; token: string };

const OBSERVE_RE = /^#\/observe\/([0-9A-Za-z_-]{4,64})$/;
const RESET_RE = /^#\/reset\/([0-9A-Za-z_-]{4,64})$/;

export function parseHash(hash: string): HashRoute {
  let m = OBSERVE_RE.exec(hash);
  if (m) return { kind: 'observe', token: m[1]! };
  m = RESET_RE.exec(hash);
  if (m) return { kind: 'reset', token: m[1]! };
  return { kind: 'home' };
}

export function observeHash(token: string): string {
  return `#/observe/${token}`;
}

/** Builds the shareable observer URL for a token (used by the copy-link button). */
export function observerLinkUrl(token: string): string {
  return `${location.origin}${location.pathname}${observeHash(token)}`;
}
