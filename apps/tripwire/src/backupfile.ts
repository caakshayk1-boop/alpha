/** Saving a file from the browser: the one download helper, small enough to sit in the main bundle so the failed-save banner can offer a backup without loading a screen. */
import { exportJson, type State } from './store.ts';

export function download(name: string, text: string, type: string) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
/** "tripwire-backup-2026-10-27.json": dated, so two backups do not overwrite each other in a downloads folder. */
export const backupName = (d = new Date()) => `tripwire-backup-${new Date(d.getTime() + 330 * 60000).toISOString().slice(0, 10)}.json`;
export const downloadBackup = (s: State) => download(backupName(), exportJson(s), 'application/json');
