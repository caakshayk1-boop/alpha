"""Validate each indexable URL against the built page and its canonical URL."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
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
expected = {"/", "/terminal/", "/calls/", "/screener/", "/gate/", "/plan/", "/about/", "/method/", "/privacy/", "/terms/"}
expected.update(f"/stock/{symbol}/" for symbol in symbols)
seen = set()
for item in root:
    assert item.tag == ns + "url" and len(item) == 1 and item[0].tag == ns + "loc"
    url = item[0].text
    address = urlsplit(url)
    assert address.scheme == "https" and address.netloc == "lockedfree.askakshay.com"
    path = unquote(address.path)
    assert path in expected and path not in seen and not address.query and not address.fragment, url
    seen.add(path)
    parser = Canonical()
    parser.feed((Path("dist") / path.strip("/") / "index.html").read_text())
    assert parser.urls == [url], (url, parser.urls)
assert seen == expected
print(f"Validated {len(seen)} sitemap URLs and canonical pages")
