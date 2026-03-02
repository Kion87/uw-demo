import crypto from "node:crypto";

export const SESSION_COOKIE = "session";

export function makeSessionToken() {
  // 32 bytes => 64 hex chars
  return crypto.randomBytes(32).toString("hex");
}

export function sessionExpiresAt(days = 30) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}
