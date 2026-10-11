import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap page-head">
      <div className="eyebrow"><b>●</b> 404</div>
      <h1 className="disp">Nothing at <em>this address.</em></h1>
      <p className="lede">The page may have moved when Signal, Vision and Gems became one desk. Start from <Link href="/" style={{ color: 'var(--accent-2)' }}>today</Link> or press ⌘K to search companies and pages.</p>
    </div>
  );
}
