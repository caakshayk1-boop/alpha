declare module "*/worker.js" {
  export function parseYahoo(res: unknown, nowMs?: number): { t: number[]; forming: boolean; live: { px: number; t: number } | null } | null;
  export function parseIntraday(res: unknown, nowMs?: number): { t: number[]; c: number[]; px: number; pt: number; prev: number; live: boolean } | null;
  export function parseChart(res: unknown, niftyRes?: unknown): { t: number[]; c: number[]; n: (number | null)[] | null } | null;
  export function parseNews(xml: string, nowMs?: number, max?: number, maxAgeDays?: number): { title: string; source: string; url: string; t: number; tags: string[]; also: number; sources: string[] }[];
  export const MACRO: Record<string, string>;
}
