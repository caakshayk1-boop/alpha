declare module "*/worker.js" {
  export function parseYahoo(res: unknown, nowMs?: number): { t: number[]; forming: boolean; live: { px: number; t: number } | null } | null;
  export function parseIntraday(res: unknown, nowMs?: number): { t: number[]; c: number[]; px: number; pt: number; prev: number; live: boolean } | null;
  export function parseChart(res: unknown, niftyRes?: unknown): { t: number[]; c: number[]; n: (number | null)[] | null } | null;
  export function parseNews(xml: string, nowMs?: number, max?: number, maxAgeDays?: number): { title: string; source: string; url: string; t: number; tags: string[]; also: number; sources: string[] }[];
  export const MACRO: Record<string, string>;
  export function parseSpark(e: unknown, nowMs?: number): { t: number[]; c: number[]; px: number; pt: number; prev: number; live: boolean } | null;
  export function trendOfRow(price: number | null | undefined, sma50: number | null | undefined, sma200: number | null | undefined): 'up' | 'mixed' | 'down' | null;
  export function aggregateBreadth(rows: { sym: string; sector?: string | null; liquid?: boolean | null; price?: number | null; sma50?: number | null; sma200?: number | null }[], live?: Record<string, number>): { n: number; up: number; mixed: number; down: number; sectors: { k: string; n: number; up: number; down: number }[] };
}
