"""Validate each indexable URL against the built page and its canonical URL."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote, quote
import json
import xml.etree.ElementTree as ET


class Canonical(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and attrs.get("rel") == "canonical":
            self.urls.append(attrs.get("href"))


root = ET.parse("dist/sitemap.xml").getroot()
ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
assert root.tag == ns + "urlset"
symbols = [row["sym"] for row in json.loads(Path("feed/screen.json").read_text())["rows"]]
expected = {"/", "/terminal/", "/calls/", "/screener/", "/practice/", "/gate/", "/plan/", "/about/", "/method/", "/privacy/", "/terms/"}
expected.update(f"/stock/{symbol}/" for symbol in symbols)
seen = set()
for item in root:
    assert item.tag == ns + "url" and len(item) == 1 and item[0].tag == ns + "loc"
    url = item[0].text
    address = urlsplit(url)
    assert address.scheme == "https" and address.netloc == "lockedfree.askakshay.com"
    path = unquote(address.path)
    assert path in expected and path not in seen and not address.query and not address.fragment, url
    assert address.path == quote(path, safe="/-._~"), url
    seen.add(path)
    parser = Canonical()
    parser.feed((Path("dist") / path.strip("/") / "index.html").read_text())
    assert parser.urls == [url], (url, parser.urls)
assert seen == expected
print(f"Validated {len(seen)} sitemap URLs and canonical pages")

# Reconcile the public summary with the same dated source rows available to the build.
snapshot = json.loads(Path("dist/data/snapshot.json").read_text())
feed = json.loads(Path("feed/screen.json").read_text())
changes = [r["r1d"] for r in feed["rows"] if isinstance(r.get("r1d"), (int, float))]
averages = [r for r in feed["rows"] if isinstance(r.get("price"), (int, float)) and (r.get("sma200") or 0) > 0]
breadth = snapshot["breadth"]
assert snapshot["close"] == feed["price_date"] and snapshot["tracked"] == len(feed["rows"])
assert breadth["counted"] == len(changes)
assert breadth["advancing"] == sum(x > 0 for x in changes)
assert breadth["declining"] == sum(x < 0 for x in changes)
assert breadth["unchanged"] == changes.count(0)
above = sum(r["price"] > r["sma200"] for r in averages)
assert breadth["above200_count"] == above and breadth["above200_eligible"] == len(averages)
assert breadth["above200_percent"] == (100 * above / len(averages) if averages else None)
