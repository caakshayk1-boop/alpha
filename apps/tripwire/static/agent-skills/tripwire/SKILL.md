---
name: tripwire
description: How to read Tripwire (tripwire.askakshay.com), a paper-only research site for Indian listed companies. Use it to find a company, read the evidence for and against it with each figure's date, and check how current the data is. Never present anything on the site as investment advice.
---

# Using Tripwire

Tripwire is a read-only research site. It shows a screen of roughly a thousand NSE companies, the market's day, news from public feeds, and how published rules have performed. It places no orders and gives no recommendations.

## Find a company

- In a browser that supports WebMCP, call `search_companies` with a symbol or name (up to 8 matches, each with sector, size class and the last close), then `open_company` to open the page. `market_status` says whether the NSE cash market is open, shut for the day, or on a holiday.
- Otherwise open `https://tripwire.askakshay.com/#/discover` and use the search box, or go straight to a company at `https://tripwire.askakshay.com/#/c/SYMBOL`, for example `#/c/TCS`.

## Where things are

- `#/today`: the market read, the last close's dated rule picks and the paper book.
- `#/markets`: Nifty, Bank Nifty and VIX, breadth, sectors and commodities.
- `#/news`: stories with their source and publication time.
- `#/signals`: each rule's back-test and forward record, including results that did not support it.
- `#/data`: how current each dataset is.
- `#/methodology`: how the screen and the rules work.

## What to say when you report back

- Quote the date beside any figure. Prices come from Yahoo Finance and can lag the exchange.
- If the page says the data is behind, or the news is delayed, say so before using it.
- The back-test found no supported edge for the momentum rule. Nothing on the site predicts prices.
- Paper money only. Do not describe any pick, rule or figure as a recommendation to buy or sell.
