/** Saving a file from the browser: the one download helper, small enough to sit in the main bundle so the failed-save banner can offer a backup without loading a screen. */
import { exportJson, type State } from './store.ts';
import { recordBackup } from './backupstatus.ts';

export function download(name: string, text: string, type: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/** "tripwire-backup-2026-10-27.json": dated, so two backups do not overwrite each other in a downloads folder. */
export const backupName = (d = new Date()) => `tripwire-backup-${new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10)}.json`;
/** A full backup: the file is built and handed to the browser, and only then is the moment recorded (guarded: blocked storage records nothing, and the download is unaffected). */
export const downloadBackup = (s: State): boolean => {
  const name = backupName(); download(name, exportJson(s), 'application/json');
  try { return recordBackup(localStorage, name); } catch { return false; }
};
