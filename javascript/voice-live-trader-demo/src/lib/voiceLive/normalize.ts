export function normalizeResourceHost(input: string): string {
  let s = input.trim();
  if (!s) return "";

  // Handle common missing-colon pastes like "https//..." or "wss//...".
  s = s
    .replace(/^https\/\//i, "https://")
    .replace(/^http\/\//i, "http://")
    .replace(/^wss\/\//i, "wss://")
    .replace(/^ws\/\//i, "ws://");

  // If it looks like a full URL, parse and use the host.
  if (s.includes("://")) {
    try {
      return new URL(s).host;
    } catch {
      // fall through
    }
  }

  // Strip scheme fragments (e.g. "https:") and any leading slashes.
  s = s.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:/, "");
  s = s.replace(/^\/+/, "");

  // Keep only host portion.
  const cut = s.search(/[/?#]/);
  if (cut >= 0) s = s.slice(0, cut);

  return s.trim();
}
