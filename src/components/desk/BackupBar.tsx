'use client';
/** Where My Desk's records live, when they were last exported, and the one backup (T06/T07): "Export everything" writes a
 *  single versioned file with every collection (lib/backup.ts); "Import" reads it (or an older Alpha export), shows what
 *  would be added, updated and skipped under the stated merge policy, and writes nothing until the reader confirms.
 *  There is no account (lib/account.ts), so the bar says the records are in this browser only and not synced. */
import { useEffect, useRef, useState } from 'react';
import { Drawer } from '@/components/company/Parts';
import { plural, stampLabel } from '@/components/desk/common';
import { ACCOUNTS_ENABLED, STORAGE_LINE } from '@/lib/account';
import { BACKUP_STALE_DAYS, COLLECTIONS, COLLECTION_LABEL, backupReminder, countOf, isEmptyDesk, mergeDesk, parseBackup, reportLines, serializeBackup, type DeskState, type MergeResult } from '@/lib/backup';
import { DESK_KEYS, LAST_EXPORT_KEY, downloadText, markExported, readDesk, readLastExport, writeDesk } from '@/lib/deskStore';

export function BackupBar({ storageOk }: { storageOk: boolean }) {
  const [state, setState] = useState<DeskState | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    const read = () => { setState(readDesk()); setLast(readLastExport()); };
    read();
    const keys = new Set<string>([...Object.values(DESK_KEYS), LAST_EXPORT_KEY]);
    const onStore = (e: Event) => { const k = e instanceof StorageEvent ? e.key : (e as CustomEvent<string>).detail; if (k === null || k === undefined || keys.has(k)) read(); };
    const any = () => read();
    window.addEventListener('alpha-store', onStore);
    window.addEventListener('storage', onStore);
    window.addEventListener(DESK_KEYS.reviews, any);
    window.addEventListener('alpha-cards-changed', any);
    return () => { window.removeEventListener('alpha-store', onStore); window.removeEventListener('storage', onStore); window.removeEventListener(DESK_KEYS.reviews, any); window.removeEventListener('alpha-cards-changed', any); };
  }, []);

  const total = state ? COLLECTIONS.reduce((n, c) => n + countOf(state, c), 0) : 0;
  const remind = state ? backupReminder(state, last) : null;
  const exportAll = () => {
    const s = readDesk();
    downloadText(`alpha-desk-backup-${new Date().toLocaleDateString('en-CA')}.json`, serializeBackup(s));
    setLast(markExported());
    setFlash(`Exported ${plural(COLLECTIONS.reduce((n, c) => n + countOf(s, c), 0), 'record')} in one file. Keep it somewhere other than this browser.`);
  };

  return (
    <section className="wrap desk-bar-wrap" aria-label="Where your records are kept">
      <div className={`desk-bar${remind ? ' remind' : ''}`}>
        <div className="desk-bar-l">
          {!ACCOUNTS_ENABLED && <span className="pill nodot">{STORAGE_LINE}</span>}
          <span className="desk-bar-t">
            {state === null ? 'Reading this browser…' : isEmptyDesk(state) ? 'Nothing saved yet.' : <>{plural(total, 'record')} saved here. {last ? <>Last exported {stampLabel(last)}.</> : <>Never exported.</>}</>}
            {remind && <b className="desk-bar-warn"> {remind === 'never' ? 'Clearing this site’s data would erase them: export a copy.' : `The last export is over ${BACKUP_STALE_DAYS} days old: export a fresh copy.`}</b>}
            {!storageOk && <b className="desk-bar-warn"> This browser is blocking storage, so changes are not being kept.</b>}
          </span>
        </div>
        <div className="desk-bar-r">
          {state && !isEmptyDesk(state) && <button type="button" className="act" onClick={exportAll}>Export everything</button>}
          <button type="button" className="act quiet" onClick={() => { setOpen(true); setFlash(null); }}>Import a backup</button>
        </div>
      </div>
      {flash && <p className="desk-flash" role="status">{flash}</p>}
      <Drawer open={open} onClose={() => setOpen(false)} title="Import a backup">
        <ImportPanel onDone={(t) => { setFlash(t); setOpen(false); }} />
      </Drawer>
    </section>
  );
}

function ImportPanel({ onDone }: { onDone: (msg: string) => void }) {
  const [paste, setPaste] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ m: MergeResult; warnings: string[]; kind: string; exportedAt: string | null } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const inspect = (text: string) => {
    setPlan(null);
    const p = parseBackup(text);
    if (!p.ok) { setErr(p.error); return; }
    setErr(null);
    setPlan({ m: mergeDesk(readDesk(), p.data), warnings: p.warnings, kind: p.kind, exportedAt: p.exportedAt });
  };
  const confirm = () => {
    if (!plan) return;
    const fresh = mergeDesk(readDesk(), Object.fromEntries(plan.m.changed.map((c) => [c, plan.m.next[c]])) as Partial<DeskState>);   // re-read: another tab may have written since the preview
    const failed = writeDesk(fresh.next, fresh.changed);
    if (failed.length) { setErr(`Could not write ${failed.map((c) => COLLECTION_LABEL[c].toLowerCase()).join(', ')} to this browser's storage. Those were not imported; the rest were.`); return; }
    const added = COLLECTIONS.reduce((n, c) => n + (plan.m.report[c]?.added ?? 0) + (plan.m.report[c]?.updated ?? 0), 0);
    onDone(added ? `Imported: ${reportLines(plan.m).join(' ')}` : 'Nothing new in that file: everything in it was already here.');
  };
  return (
    <div className="desk-import">
      <p className="dim desk-small">Reads a file from &ldquo;Export everything&rdquo;, and older Alpha exports (a research library, one card, or a journal file). Nothing is written until you confirm.</p>
      <details className="dcard-more">
        <summary>How an import merges</summary>
        <ul className="desk-plain">
          <li>Followed companies and conditions: added if new; the same one is skipped.</li>
          <li>Research cards and journal entries: matched by id. A new one is added; the same one is replaced only if the file&apos;s copy was edited later.</li>
          <li>Saved screens: matched by name; a different screen with the same name keeps yours unless the file&apos;s is dated later.</li>
          <li>Review snapshots: the later one for each company is kept.</li>
          <li>Nothing here is deleted, so importing the same file twice changes nothing.</li>
        </ul>
      </details>
      <div className="desk-formacts">
        <button type="button" className="act primary" onClick={() => file.current?.click()}>Choose a file…</button>
        <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Choose a backup file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) inspect(await f.text()); e.target.value = ''; }} />
      </div>
      <label htmlFor="imp-paste" className="note-form"><span>Or paste the file&apos;s contents</span><textarea id="imp-paste" className="field desk-mono" rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} spellCheck={false} /></label>
      <button type="button" className="act" disabled={!paste.trim()} onClick={() => inspect(paste)}>Check pasted text</button>
      {err && <div className="state desk-state-bad" role="alert"><b>Nothing was imported.</b><p>{err}</p></div>}
      {plan && (
        <div className="state" role="status">
          <b>{plan.m.changed.length ? 'Preview: nothing is saved until you confirm' : 'Everything in this file is already here'}</b>
          <p className="dim">{plan.kind === 'backup' ? 'Alpha backup' : plan.kind === 'library' ? 'Older research library' : plan.kind === 'card' ? 'One research card' : 'Journal file'}{plan.exportedAt ? `, exported ${stampLabel(plan.exportedAt)}` : ''}.</p>
          <ul className="desk-plain">{reportLines(plan.m).map((l) => <li key={l}>{l}</li>)}</ul>
          {[...plan.m.notes, ...plan.warnings].length > 0 && <ul className="desk-plain dim">{[...plan.m.notes, ...plan.warnings].slice(0, 8).map((w) => <li key={w}>{w}</li>)}</ul>}
          <div className="acts">
            {plan.m.changed.length > 0 && <button type="button" className="act primary" onClick={confirm}>Import</button>}
            <button type="button" className="act quiet" onClick={() => setPlan(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
