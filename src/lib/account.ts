/** The account boundary. Alpha has no sign-in, no user database and no sync: everything the reader saves stays in this
 *  browser. Pages that would show sync or sign-in read this flag instead of implying either exists. Turning it on is a
 *  product decision that needs real account infrastructure first; until then nothing reads as synced. */
export const ACCOUNTS_ENABLED = false as const;
export const STORAGE_LINE = 'Saved in this browser only; not synced';
