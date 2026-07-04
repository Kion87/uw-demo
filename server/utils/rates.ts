// server/utils/rates.ts
import { uniwireRequest } from "./uniwire";

type UniwireRateEntry = {
  id?: string;
  kind?: string;
  symbol?: string;
  rate_usd?: number | string;
  rate_btc?: number | string;
  sign?: string;
};

function extractRateList(res: any): UniwireRateEntry[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.result)) return res.result;
  if (Array.isArray(res?.content?.result)) return res.content.result;

  console.error(
    "Unexpected Uniwire exchange-rates response shape:",
    JSON.stringify(res, null, 2),
  );
  return [];
}

export async function getRatesUsd(): Promise<Map<string, number>> {
  const rates = new Map<string, number>();

  try {
    const res = await uniwireRequest<any>("/v1/exchange-rates/", {}, "GET");
    const list = extractRateList(res);

    for (const entry of list) {
      const symbol = entry?.symbol ? String(entry.symbol).toUpperCase() : null;
      const rateUsd = Number(entry?.rate_usd);
      if (symbol && Number.isFinite(rateUsd)) {
        rates.set(symbol, rateUsd);
      }
    }
  } catch (e) {
    console.error("Failed to fetch Uniwire exchange rates:", e);
  }

  return rates;
}
