/** Curated starting points for Indian equities (Pro §28 P1). Each is an ordinary query: choosing one fills the box, and the
 *  exact clauses it applies appear as chips that can be switched off or edited. Nothing is hidden inside a template. */
export const TEMPLATES: { name: string; q: string; why: string }[] = [
  { name: 'Quality at a fair price', q: 'quality cheap roce above 15', why: 'High quality score, cheap against its own P/E history, ROCE at least 15%' },
  { name: 'Low-debt compounders', q: 'debt free growth roce above 18 profitable', why: 'Debt/equity 0.3 or less, revenue CAGR 15%+, ROCE 18%+, profitable' },
  { name: 'Cash-rich small caps', q: 'small cap cash generative low debt liquid', why: 'Small cap, operating cash at least 0.8× profit, low debt, ₹10 cr+ a day traded' },
  { name: 'Dividend payers with cover', q: 'dividend yield above 2 profitable cash backed', why: 'Yield 2%+, profitable, profit backed by cash' },
  { name: 'Leaders near their highs', q: 'uptrend near 52 week high momentum liquid', why: 'Price above rising averages, within 5% of the 52-week high, strong 3-month relative strength' },
  { name: 'Banks earning their capital', q: 'banks roe above 14 pb under 3', why: 'Banks (named "… Bank"), ROE 14%+, P/B under 3' },
];
