export type CookieOptions = {
  days?: number;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
};

export function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const target = `${encodeURIComponent(name)}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return undefined;
}

export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
  if (typeof document === "undefined") return;

  const path = options.path ?? "/";
  const sameSite = options.sameSite ?? "Lax";
  const secure = options.secure ?? false;

  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;

  if (options.days && Number.isFinite(options.days)) {
    const maxAge = Math.floor(options.days * 24 * 60 * 60);
    cookie += `; Max-Age=${maxAge}`;
  }

  if (secure) cookie += "; Secure";

  document.cookie = cookie;
}

export function deleteCookie(name: string, path = "/"): void {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(name)}=; Path=${path}; Max-Age=0; SameSite=Lax`;
}
