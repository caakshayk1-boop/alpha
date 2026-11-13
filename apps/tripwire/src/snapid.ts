/** The id of the paper-book snapshot the Book last drew (ledgerview.ts snapshotOf). Kept here so #/info can print it without the Book's main view carrying it. Null until the Book has been opened this session. */
let id: string | null = null;
export const setCurrentSnapshotId = (v: string | null) => { id = v; };
export const currentSnapshotId = () => id;
