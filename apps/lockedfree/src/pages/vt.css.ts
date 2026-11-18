// Editorial view-transition names. Stock names live in /vt-stocks.css (terminal pages and Calls only).
export const GET = () => new Response('.vt-equity{view-transition-name:equity-card}\n', { headers: { 'content-type': 'text/css' } });
