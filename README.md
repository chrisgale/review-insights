# review-insights

Daily AI-powered review summaries for Holiday Extras products. Runs every day, pulls from the HX reviews-service (via BigQuery or RPC fallback), uses AI to summarise what customers think about each chipscode, and exposes a clean API.

## What it does

For each chipscode:
- Fetches all approved reviews (rating 1–10, comment text) from the reviews-service
- Groups by `base_product` from HXCM so many chipscodes under one physical location are handled correctly
- Uses AI to summarise what customers actually say — not a star average, but a human-readable verdict
- Derives a quality label (Excellent / Good / Mixed / Poor) from `avg_score`
- Refreshes daily, stores the result with a `lastUpdated` timestamp

## Run the sandbox

```bash
node sandbox/server.js
# Listening on http://localhost:3020
```

No dependencies. Pure Node.js. Stateful in-memory.

**Test data**
| | |
|---|---|
| Chipscode | `LGW9` (Gatwick parking), `LGWP1` (Gatwick hotel) |
| Base product | `LGW` (Gatwick) |
| Sandbox base URL | `http://localhost:3020` |

---

## API

### 1 — Get AI summary for a chipscode

```
GET /reviews/LGW9/summary
```

```json
{
  "chipscode": "LGW9",
  "baseProduct": "LGW",
  "productName": "Gatwick Long Stay North",
  "summary": "Customers rate this car park very highly. The shuttle bus is consistently praised for being frequent and reliable. A few reviewers mention the walk from the bus drop-off can be long with heavy luggage, but the majority say the process was smooth and stress-free. Value for money comes up repeatedly as a positive.",
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

**Quality labels** (derived from `avg_score`):

| Label | Score range |
|---|---|
| Excellent | 8.5 – 10 |
| Good | 7.0 – 8.4 |
| Mixed | 5.0 – 6.9 |
| Poor | < 5.0 |

---

### 2 — Get summaries for multiple chipscodes

```
GET /reviews/summary?chipscodes=LGW9,LGWP1,LGWH1
```

```json
{
  "summaries": [
    {
      "chipscode": "LGW9",
      "baseProduct": "LGW",
      "productName": "Gatwick Long Stay North",
      "summary": "Customers rate this car park very highly...",
      "score": 8.7,
      "scoreOutOf": 10,
      "qualityLabel": "Excellent",
      "totalReviews": 1423,
      "wouldBookAgainPercent": 94,
      "lastUpdated": "2026-07-01T06:00:00Z"
    },
    {
      "chipscode": "LGWP1",
      "baseProduct": "LGW",
      "productName": "Bloc Hotel Gatwick",
      "summary": "Reviewers love the location directly in the South Terminal. Rooms are described as compact but well designed. Check-in is praised as fast. Some mention noise from the terminal but most say it did not affect their stay.",
      "score": 9.1,
      "scoreOutOf": 10,
      "qualityLabel": "Excellent",
      "totalReviews": 876,
      "wouldBookAgainPercent": 97,
      "lastUpdated": "2026-07-01T06:00:00Z"
    }
  ],
  "generatedAt": "2026-07-01T06:00:00Z"
}
```

---

### 3 — Get all summaries for a base product (physical location)

```
GET /reviews/base/LGW/summary
```

Returns all chipscodes grouped under the `LGW` base product — useful for displaying all products at a location together.

```json
{
  "baseProduct": "LGW",
  "location": "London Gatwick",
  "summaries": [
    {
      "chipscode": "LGW9",
      "productName": "Gatwick Long Stay North",
      "score": 8.7,
      "qualityLabel": "Excellent",
      "totalReviews": 1423,
      "summary": "...",
      "lastUpdated": "2026-07-01T06:00:00Z"
    },
    {
      "chipscode": "LGWP1",
      "productName": "Bloc Hotel Gatwick",
      "score": 9.1,
      "qualityLabel": "Excellent",
      "totalReviews": 876,
      "summary": "...",
      "lastUpdated": "2026-07-01T06:00:00Z"
    }
  ],
  "generatedAt": "2026-07-01T06:00:00Z"
}
```

---

### 4 — Get raw reviews for a chipscode (pass-through from reviews-service)

```
GET /reviews/LGW9/raw?limit=20&pastMonths=12&highRatedOnly=false
```

```json
{
  "chipscode": "LGW9",
  "totalReviews": 1423,
  "reviews": [
    {
      "reviewId": "rev_abc123",
      "rating": 9,
      "commentText": "Great shuttle service, very frequent. Would definitely use again.",
      "wouldBookProduct": true,
      "wouldBookService": true,
      "brand": "HX",
      "createdAt": "2026-06-15T10:22:00Z"
    },
    {
      "reviewId": "rev_def456",
      "rating": 8,
      "commentText": "Good value, easy process. Shuttle slightly long wait at peak time.",
      "wouldBookProduct": true,
      "wouldBookService": true,
      "brand": "HX",
      "createdAt": "2026-06-10T08:11:00Z"
    }
  ]
}
```

---

## Data sources

### Primary — BigQuery (daily cron)

The `reviews_bigquery` table in the reviews-service database is synced daily from BigQuery. Fields used:

| Field | Description |
|---|---|
| `product_code` | Chipscode |
| `review_count` | Total approved reviews |
| `avg_score` | Average rating (1–10) |
| `avg_book_again_percent` | % of reviewers who would book again |
| `comments` | JSON array of recent comment texts |
| `highlighted_comments` | Curated highlighted comments |

The daily cron calls `summaryByProduct` RPC with each chipscode, then runs AI summarisation over the returned comments.

### Fallback — RPC

If BigQuery data is stale or unavailable, the service falls back to calling `reviewsByProduct` RPC directly.

**RPC functions available in `holidayextras/reviews-service`:**

| Function | Input | Description |
|---|---|---|
| `reviewsByProduct` | `productCodes[]`, `brand[]`, `limit`, `pastMonths`, `highRatedOnly` | Fetch individual reviews for chipscodes |
| `summaryByProduct` | `productCodes[]`, `brand[]` | Fetch pre-computed summary (score, count, comments) per chipscode |
| `reviewsByLocation` | `location` (airport code), `type`, `lang` | Fetch all reviews for a location |
| `summaryByLocation` | `location`, `type`, `lang` | Fetch summary for all products at a location |

### Product grouping — HXCM

Chipscodes are grouped by `base_product` from the HXCM product endpoint. Many chipscodes can represent the same physical location (e.g. different room types at one hotel all share a `base_product`). Summaries are generated per chipscode but the `base_product` endpoint returns all of them together.

---

## Daily cron

The cron script (`cron/daily-refresh.js`) runs at 06:00 UTC:

1. Fetches all active chipscodes from HXCM
2. Groups them by `base_product`
3. For each chipscode, calls `summaryByProduct` RPC to get score, review count, and recent comments
4. Passes up to 50 recent approved comments to the AI summarisation prompt
5. Stores the generated summary, score, label, and `lastUpdated` timestamp
6. Exposes the result via the API

```bash
node cron/daily-refresh.js
```

---

## AI summarisation prompt

The AI receives:

```
You are summarising customer reviews for a Holiday Extras product.

Product: {productName} ({chipscode})
Average score: {avgScore}/10 from {reviewCount} reviews
Would book again: {wouldBookAgainPercent}%

Recent customer comments:
{comments}

Write 2–3 sentences summarising what customers think about this product.
Be specific — mention what they praise and what they criticise.
Write in plain English, no marketing language.
Do not mention the score or number of reviews.
```

---

## Endpoint index

| Method | Path | Description |
|---|---|---|
| GET | `/reviews/{chipscode}/summary` | AI summary + score for one chipscode |
| GET | `/reviews/summary?chipscodes=X,Y,Z` | Batch summaries |
| GET | `/reviews/base/{baseProduct}/summary` | All chipscodes under a base product |
| GET | `/reviews/{chipscode}/raw` | Raw reviews pass-through |

Full OpenAPI spec: [`openapi.yaml`](openapi.yaml)
AI coding context: [`AI.md`](AI.md)
