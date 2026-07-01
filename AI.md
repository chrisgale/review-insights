# Review Insights API — AI Coding Context

Load this file into Codex or Claude Code to give your AI session full context on the review insights API.

## What this API does

Daily AI-powered review summaries for Holiday Extras products. Summaries are pre-computed each day from the reviews-service and exposed as a clean read-only API. Base URL (sandbox): `http://localhost:3020`.

## Key concepts

**Chipscode** — the HX product identifier (e.g. `LGW9`). One physical location can have many chipscodes (e.g. multiple car parks or hotel room types at Gatwick).

**base_product** — groups chipscodes that belong to the same physical location. Comes from the HXCM product endpoint. Use `/reviews/base/{baseProduct}/summary` to get all products at a location together.

**Quality label** — derived from `avg_score` (1–10 scale from reviews-service):
- `Excellent` — score >= 8.5
- `Good` — score 7.0–8.4
- `Mixed` — score 5.0–6.9
- `Poor` — score < 5.0

**Data source** — BigQuery primary via reviews-service RPC (`summaryByProduct`, `reviewsByProduct`). Schema fields: `product_code`, `review_count`, `avg_score`, `avg_book_again_percent`, `comments[]`.

## Endpoints

```javascript
// Single chipscode summary
GET /reviews/{chipscode}/summary
// Returns: chipscode, baseProduct, productName, summary (AI text),
//          score, scoreOutOf, qualityLabel, totalReviews, wouldBookAgainPercent,
//          lastUpdated, nextUpdateAt

// Batch summaries
GET /reviews/summary?chipscodes=LGW9,LGWP1,MAN1

// All chipscodes at a location
GET /reviews/base/{baseProduct}/summary

// Raw reviews (pass-through from reviews-service)
GET /reviews/{chipscode}/raw?limit=20&pastMonths=12&highRatedOnly=false
```

## Response shape (single summary)

```json
{
  "chipscode": "LGW9",
  "baseProduct": "LGW",
  "productName": "Gatwick Long Stay North",
  "summary": "Customers rate this car park very highly. The shuttle bus is consistently praised...",
  "score": 8.7,
  "scoreOutOf": 10,
  "qualityLabel": "Excellent",
  "totalReviews": 1423,
  "reviewsUsedForSummary": 50,
  "wouldBookAgainPercent": 94,
  "lastUpdated": "2026-07-01T06:00:00Z",
  "nextUpdateAt": "2026-07-02T06:00:00Z"
}
```

## Data pipeline (daily cron at 06:00 UTC)

1. Fetch active chipscodes from HXCM
2. Call `summaryByProduct` RPC for each chipscode → get score, count, comments
3. Pass up to 50 comments to AI summarisation prompt
4. Store result with `lastUpdated` timestamp
5. API serves stored results — no live RPC call on every API request

## RPC functions (holidayextras/reviews-service)

```javascript
// Pre-computed summary — use this for the daily cron
summaryByProduct({ productCodes: ['LGW9'], brand: [''] })
// Returns: { LGW9: { product_code, review_count, avg_score, avg_book_again_percent, comments[] } }

// Individual reviews — use for raw pass-through or re-summarisation
reviewsByProduct({ productCodes: ['LGW9'], brand: [''], limit: 50, highRatedOnly: false })
// Returns reviews with: rating (1-10), comment_text, would_book_product, would_book_service, created_at

// Location-level (all chipscodes at an airport)
summaryByLocation({ location: 'LGW', type: 'carpark', lang: 'en' })
reviewsByLocation({ location: 'LGW', type: 'carpark', lang: 'en', limit: 50 })
```

## AI summarisation prompt

```
You are summarising customer reviews for a Holiday Extras product.

Product: {productName} ({chipscode})
Average score: {avgScore}/10 from {reviewCount} reviews
Would book again: {wouldBookAgainPercent}%

Recent customer comments:
{comments}

Write 2-3 sentences summarising what customers think about this product.
Be specific — mention what they praise and what they criticise.
Write in plain English, no marketing language.
Do not mention the score or number of reviews.
```

## Sandbox test data

```
Chipscode   Base    Product name                  Score  Label
LGW9        LGW     Gatwick Long Stay North       8.7    Excellent
LGWP1       LGW     Bloc Hotel Gatwick            9.1    Excellent
LGWH1       LGW     Hilton London Gatwick         8.2    Good
MAN1        MAN     Manchester Airport CP1        6.8    Mixed
MANL1       MAN     Aspire Lounge Manchester T1   9.3    Excellent

Sandbox URL: http://localhost:3020
```

Start sandbox:
```bash
node sandbox/server.js
```

## Notes

- Summaries are read-only — the API never writes to the reviews-service
- `lastUpdated` tells you when the AI summary was last regenerated — show this to users
- `totalReviews` is the full count; `reviewsUsedForSummary` is how many the AI actually read (capped at 50)
- `wouldBookAgainPercent` comes directly from the reviews-service `avg_book_again_percent` field
- Many chipscodes can map to the same physical location — always group by `baseProduct` when displaying a location view
