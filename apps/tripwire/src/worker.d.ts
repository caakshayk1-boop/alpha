declare module "*/worker.js" { export function parseYahoo(res: unknown, nowMs?: number): { t: number[]; forming: boolean; live: { px: number; t: number } | null } | null }
