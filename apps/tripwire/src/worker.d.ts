declare module "*/worker.js" {
  export function parseYahoo(res: unknown, nowMs?: number): { t: number[]; forming: boolean; live: { px: number; t: number } | null } | null;
  export function parseIntraday(res: unknown, nowMs?: number): { t: number[]; c: number[]; px: number; pt: number; prev: number; live: boolean } | null;
  export function parseChart(res: unknown, niftyRes?: unknown): { t: number[]; c: number[]; n: (number | null)[] | null } | null;
}
