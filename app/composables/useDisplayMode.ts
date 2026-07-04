export type DisplayMode = "usd" | "crypto";

export function useDisplayMode() {
  return useState<DisplayMode>("displayMode", () => "usd");
}
