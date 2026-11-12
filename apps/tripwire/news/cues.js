// Global cues: the headlines from outside India that Indian readers use as context, and the plain-language map of HOW each one connects to India.
// RULES FIRST, NO MODEL (the same split as the rest of this folder): a cue is a headline that matches one of the patterns below. Nothing here reads a headline's sentiment,
// scores it, or says what a market will do. The "channel" is a standing description of the connection (what the Indian side is exposed to), written once, reviewed once,
// the same for every headline of that kind. The reader sees the live, measured moves beside it (the linked instrument and the sectors, from data this app already holds);
// the app does not translate a headline into a direction. Copy must pass the shared forbidden-words lint (src/brief.ts FORBIDDEN): tests/cues.test.ts.
// Plain data and regular expressions only: this file is imported by the Worker, the Node job and the browser.

/** Sector names are the screen's own (the data provider's sector labels), so a sector chip can read its measured day change off the screen with no mapping layer. */
export const SECTORS = ['Financial Services', 'Consumer Cyclical', 'Industrials', 'Technology', 'Basic Materials', 'Healthcare', 'Energy', 'Consumer Defensive', 'Communication Services', 'Utilities', 'Real Estate'];
/** The live instruments a cue can show beside it: the macro keys (src/macro.ts) and the index keys the Worker already serves. */
export const MEASURES = ['GOLD', 'SILVER', 'BRENT', 'WTI', 'USDINR', 'BTC', 'NIFTY', 'BANKNIFTY', 'VIX'];

/** `test` is matched against the headline only. Patterns are deliberately narrow: a missed cue is a gap the reader can see, a wrong cue is a false link. */
export const CUES = [
  { id: 'fed_rates', label: 'US rates and the Fed', test: /\b(federal reserve|the fed\b|fed (holds|keeps|signals|cuts|hikes|raises|pauses|minutes|officials?|chair)|fomc|jerome powell|treasury yields?|10-year yield|us (inflation|jobs report|payrolls?|cpi)|nonfarm payrolls?)\b/i,
    channel: 'US interest rates set the price of dollars worldwide. Overseas funds compare them with Indian yields, and the rupee is quoted against the dollar.',
    exposed: 'Rate-sensitive balance sheets (lenders, property, utilities) and every importer or exporter that prices in dollars.', sectors: ['Financial Services', 'Real Estate', 'Utilities'], measure: 'USDINR', watch: 'US 10-year yield, USD/INR, foreign institutional flows' },
  { id: 'us_equities', label: 'Wall Street', test: /\b(wall street|s&p 500|nasdaq|dow jones|us stocks|u\.s\. stocks)\b/i,
    channel: 'India opens after the US close, so the US session is the first full read of global risk appetite that Indian traders see each morning.',
    exposed: 'Technology and other names with large overseas revenue or overseas ownership.', sectors: ['Technology', 'Communication Services'], measure: 'VIX', watch: 'India VIX, Nifty at the open, technology sector' },
  { id: 'crude', label: 'Crude oil', test: /\b(crude( oil)?|brent|wti|opec\+?|oil prices?|oil (rises|falls|jumps|slumps|surges|slides|climbs))\b/i,
    channel: 'India imports most of the crude it uses. The oil price feeds the import bill, the rupee and input costs; producers and the firms that use fuel sit on opposite sides.',
    exposed: 'Oil producers and refiners on one side; airlines, paints, tyres and chemicals that use oil-linked inputs on the other.', sectors: ['Energy', 'Industrials', 'Consumer Cyclical', 'Basic Materials'], measure: 'BRENT', watch: 'Brent, USD/INR, the Energy sector' },
  { id: 'dollar', label: 'Dollar and currencies', test: /\b(dollar index|dxy|greenback|emerging[- ]market currenc(y|ies)|safe[- ]haven (dollar|currency))\b/i,
    channel: 'A stronger or weaker dollar changes what Indian exporters earn and importers pay in rupees, and it moves the cost of dollar debt.',
    exposed: 'Software and pharma exporters (dollar revenue) and importers or firms with dollar borrowings (dollar costs).', sectors: ['Technology', 'Healthcare', 'Energy'], measure: 'USDINR', watch: 'USD/INR, foreign institutional flows' },
  { id: 'metals', label: 'Gold and metals', test: /\b(gold (price|prices|rises|falls|hits|rallies|slips|jumps)|silver (price|prices)|copper|aluminium|aluminum|iron ore|steel (price|prices))\b/i,
    channel: 'Gold is both a safe-haven asset and one of India\'s largest imports. Base-metal prices are the selling price for metal producers and an input cost for makers.',
    exposed: 'Metal and mining firms (selling price), jewellers and lenders against gold (gold price), engineering firms (input cost).', sectors: ['Basic Materials', 'Consumer Cyclical', 'Industrials'], measure: 'GOLD', watch: 'Gold, silver, the Basic Materials sector' },
  { id: 'china_asia', label: 'China and Asia', test: /\b(china|chinese|hang seng|shanghai|nikkei|kospi|pboc|asian (markets?|stocks|shares)|asia[- ]pacific)\b/i,
    channel: 'Asian markets trade during Indian hours. China\'s demand sets many metal and chemical prices, and emerging-market funds allocate across the whole region.',
    exposed: 'Metals, chemicals and capital goods that compete with China or supply it.', sectors: ['Basic Materials', 'Industrials'], measure: 'NIFTY', watch: 'Nifty through the Asian session, the Basic Materials sector' },
  { id: 'europe', label: 'Europe', test: /\b(ecb|european central bank|eurozone|euro area|ftse|dax\b|euro stoxx|european (stocks|shares|markets?|union))\b/i,
    channel: 'Europe is a large buyer of Indian goods and services, and its markets open in the middle of the Indian session.',
    exposed: 'Exporters with European clients: software, pharma, engineering and chemicals.', sectors: ['Technology', 'Healthcare', 'Industrials'], measure: 'NIFTY', watch: 'Nifty, USD/INR' },
  { id: 'geopolitics', label: 'Trade and geopolitics', test: /\b(tariffs?|sanctions?|trade (war|deal|talks)|red sea|strait of hormuz|ceasefire|geopolitic\w*|embargo)\b/i,
    channel: 'Shipping routes, sanctions and tariffs change freight costs, oil supply and the access Indian exporters have to foreign markets.',
    exposed: 'Oil, shipping, and exporters of goods and services.', sectors: ['Energy', 'Industrials', 'Healthcare'], measure: 'VIX', watch: 'India VIX, Brent, USD/INR' },
  { id: 'global_tech', label: 'Global technology', test: /\b(nvidia|openai|artificial intelligence|\bai (boom|spending|chips?|stocks?)|chipmakers?|semiconductors?|big tech|microsoft|alphabet|apple earnings|amazon earnings)\b/i,
    channel: 'Spending plans of the large US technology firms are a read of global technology demand, which Indian software services serve with a lag.',
    exposed: 'Software and IT services with US clients.', sectors: ['Technology', 'Communication Services'], measure: 'NIFTY', watch: 'The Technology sector, USD/INR' },
  { id: 'global_growth', label: 'Global growth', test: /\b(imf|world bank|oecd|global (growth|economy|recession|demand)|us (gdp|recession)|world economy|manufacturing pmi)\b/i,
    channel: 'Global demand sets Indian export orders and commodity prices. IMF and World Bank forecasts also reset the comparison made with India\'s own growth.',
    exposed: 'Exporters, commodity producers and capital goods.', sectors: ['Industrials', 'Basic Materials', 'Technology'], measure: 'NIFTY', watch: 'Nifty, the Industrials sector' },
];
export const cueById = (id) => CUES.find((c) => c.id === id) ?? null;
/** The cues a headline matches, most specific first (the order of CUES), at most two: a story about "Fed rates and a stronger dollar" is both and says so. */
export function classifyCue(title) {
  const t = String(title ?? ''); const out = [];
  for (const c of CUES) if (c.test.test(t)) { out.push(c.id); if (out.length === 2) break; }
  return out;
}
/** The searches the job runs for global cues. Plain words: Bing returns nothing for an OR query. Each is a separate Google News RSS search, read with the same fetcher as the market queries. */
export const GLOBAL_QUERIES = ['Wall Street stocks Fed when:1d', 'crude oil Brent OPEC when:1d', 'dollar index Treasury yields when:1d', 'China Asian markets Hang Seng Nikkei when:1d', 'gold silver copper prices when:1d', 'tariffs sanctions trade geopolitics when:1d', 'Nvidia big tech earnings when:2d'];
/** How a cue reaches the Indian reader, for the News page and the Markets instruments: the standing text, never a forecast. */
export const CUE_COPY_FIELDS = ['label', 'channel', 'exposed', 'watch'];
