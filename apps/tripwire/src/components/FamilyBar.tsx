/** The askakshay family bar (28 Nov 2026): the same four names on all four sites, the current one marked. Plain links. */
export const FAMILY: ReadonlyArray<readonly [string, string]> = [
  ['Alpha', 'https://alpha.askakshay.com/'],
  ['Rulebook', 'https://lockedfree.askakshay.com/'],
  ['Tripwire', '#/'],
  ['ApexPro', 'https://apexpro.askakshay.com/'],
];
export function FamilyBar() {
  return <nav className="famibar" aria-label="askakshay products" data-noprint>
    <span className="famibar-k" aria-hidden="true">askakshay</span>
    <ul>{FAMILY.map(([n, h]) => <li key={n}>{n === 'Tripwire' ? <a href={h} aria-current="true">{n}</a> : <a href={h}>{n}</a>}</li>)}</ul>
  </nav>;
}
