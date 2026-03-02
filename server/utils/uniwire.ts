// server/utils/uniwire.ts
import crypto from "node:crypto";

const API_URL = "https://api.uniwire.com";

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function toBase64(str: string) {
  return Buffer.from(str, "utf8").toString("base64");
}

function hmacSha256Hex(secret: string, msgBase64: string) {
  return crypto.createHmac("sha256", secret).update(msgBase64).digest("hex");
}

export type UniwireMethod = "GET" | "POST" | "PUT" | "DELETE";

export async function uniwireRequest<T>(
  endpoint: string,
  payload: Record<string, any> = {},
  method: UniwireMethod = "GET",
): Promise<T> {
  const key = mustEnv("UNIWIRE_API_KEY");
  const secret = mustEnv("UNIWIRE_API_SECRET");

  // Uniwire expects the endpoint string in payload.request exactly like "/v1/..."
  if (!endpoint.startsWith("/")) endpoint = `/${endpoint}`;

  const nonce = Date.now(); // ms timestamp is recommended
  const fullPayload = {
    ...payload,
    request: endpoint,
    nonce,
  };

  const json = JSON.stringify(fullPayload);
  const b64 = toBase64(json);
  const signature = hmacSha256Hex(secret, b64);

  // IMPORTANT: Uniwire says payload goes in X-CC-PAYLOAD header, not request body. :contentReference[oaicite:1]{index=1}
  return await $fetch<T>(endpoint, {
    baseURL: API_URL,
    method,
    headers: {
      "X-CC-KEY": key,
      "X-CC-PAYLOAD": b64,
      "X-CC-SIGNATURE": signature,
      Accept: "application/json",
    },
  }) as T;
}
