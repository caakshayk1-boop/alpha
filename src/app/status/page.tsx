'use client';
/** Data status (27 Nov 2026): the same table that sits on About, at its own address, so "is the data current?" has one place to point to. It reads the shared status contract (lib/status.ts), so it cannot disagree with the stamps on other pages. */
import Link from 'next/link';
import { PageHead, Rv } from '@/components/ui';
import { DataStatusTable } from '@/components/DataStamp';

export default function StatusPage() {
  return (
    <>
      <PageHead eyebrow="Data status" title="Is the data" em="current?" />
      <section className="wrap section">
        <Rv className="panel tight">
          <p className="muted" style={{ fontSize: 14, margin: '0 0 10px' }}>
            &ldquo;Describes&rdquo; is the session or week the values are about. &ldquo;Last refreshed&rdquo; is when the source last updated. A dataset is <b>current</b> when it describes the session Alpha should already hold, <b>delayed</b> when it is one or two sessions behind, and <b>stale</b> when it is three or more behind. When a dataset is stale, pages say so instead of showing it as today&apos;s.
          </p>
          <DataStatusTable />
          <p className="dim" style={{ fontSize: 13, margin: '12px 0 0' }}>
            Where each number comes from and how it is made: <Link className="link" href="/about/#data-dates">Method and sources</Link>.
          </p>
        </Rv>
      </section>
    </>
  );
}
