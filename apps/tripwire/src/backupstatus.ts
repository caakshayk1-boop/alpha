/** When a backup file was last created on this device, recorded so Settings can say so. What is recorded, and what is not:
 *    - recorded: the moment an export was generated and handed to the browser's download. That is the only moment Tripwire can observe.
 *    - not known: whether the person kept the file, where it went, or whether it still exists. A browser does not report a finished save, so the page says "created", never "saved safely".
 *  The record lives in its own storage key, outside the saved state, so it is never part of a backup file, never changes the backup format, and is not touched by an import or a merge.
 *  Storage can be blocked (private window, full disk): every read and write is guarded, a failed write records nothing, and the page then says that no backup is recorded. Pure; storage is an argument. */
export const BACKUP_KEY = 'tripwire:v1:lastbackup';
export interface BackupRecord { at: string; file: string }
type Store = Pick<Storage, 'getItem' | 'setItem'> | null | undefined;

/** Record that an export was created. Returns true only when the record was written AND reads back; never throws. */
export function recordBackup(store: Store, file: string, now = new Date()): boolean {
  try {
    if (!store) return false; const rec: BackupRecord = { at: now.toISOString(), file }; store.setItem(BACKUP_KEY, JSON.stringify(rec));
    return store.getItem(BACKUP_KEY) === JSON.stringify(rec);
  } catch { return false; }
}
/** The recorded export, or null when none was recorded, storage is blocked, or the stored value is not a record this code wrote. */
export function readBackup(store: Store): BackupRecord | null {
  try {
    if (!store) return null; const raw = store.getItem(BACKUP_KEY); if (!raw) return null; const v = JSON.parse(raw) as Partial<BackupRecord>;
    return typeof v.at === 'string' && Number.isFinite(Date.parse(v.at)) && typeof v.file === 'string' ? { at: v.at, file: v.file } : null;
  } catch { return null; }
}
/** The sentence Settings prints. With no record it says exactly that; with one it says when the file was created and what that does not prove. */
export function backupStatus(rec: BackupRecord | null, nowMs: number): { recorded: boolean; headline: string; note: string } {
  if (!rec) return { recorded: false, headline: 'No backup recorded on this device', note: 'Nothing on this device tells Tripwire a backup file was ever made here. A backup made on another device, or before this note existed, is not counted.' };
  const t = Date.parse(rec.at); const ago = Math.max(0, nowMs - t); const m = Math.round(ago / 60000);
  const rel = m < 2 ? 'just now' : m < 60 ? `${m} minutes ago` : m < 1440 ? `${Math.round(m / 60)} hours ago` : `${Math.round(m / 1440)} days ago`;
  return { recorded: true, headline: `Last backup file created ${rel}`, note: `${rec.file}, created ${new Date(t + 330 * 60000).toISOString().slice(0, 16).replace('T', ' ')} IST. The browser does not report whether you kept the file, so this records that it was made, not where it is now.` };
}
