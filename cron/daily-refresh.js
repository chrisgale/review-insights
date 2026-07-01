/**
 * Daily review refresh cron
 * Runs at 06:00 UTC. Pulls summaries from reviews-service (BigQuery via RPC),
 * runs AI summarisation per chipscode, stores results.
 *
 * Source: holidayextras/reviews-service RPC functions
 *   - summaryByProduct({ productCodes: [chipscode], brand: [''] })
 *     Returns: { product_code, review_count, avg_score, avg_book_again_percent, comments[] }
 *   - reviewsByProduct({ productCodes: [chipscode], brand: [''], limit: 50 })
 *     Returns individual reviews with rating + comment_text fields
 *
 * BigQuery table reference (reviews_bigquery):
 *   product_code, review_count, avg_score, avg_book_again_percent,
 *   comments (JSON array), highlighted_comments (JSON array)
 */

const { rpc } = require('@holidayextras/node-toolbox');

const QUALITY_LABELS = [
  { min: 8.5, label: 'Excellent' },
  { min: 7.0, label: 'Good' },
  { min: 5.0, label: 'Mixed' },
  { min: 0,   label: 'Poor' },
];

function qualityLabel(score) {
  return (QUALITY_LABELS.find(q => score >= q.min) || QUALITY_LABELS[QUALITY_LABELS.length - 1]).label;
}

async function summariseWithAI(productName, chipscode, avgScore, reviewCount, wouldBookAgainPercent, comments) {
  // Replace with your AI client (OpenAI, Anthropic, etc.)
  // Prompt designed for concise, specific, non-marketing output
  const prompt = `You are summarising customer reviews for a Holiday Extras product.

Product: ${productName} (${chipscode})
Average score: ${avgScore}/10 from ${reviewCount} reviews
Would book again: ${wouldBookAgainPercent}%

Recent customer comments:
${comments.slice(0, 50).join('\n')}

Write 2-3 sentences summarising what customers think about this product.
Be specific — mention what they praise and what they criticise.
Write in plain English, no marketing language.
Do not mention the score or number of reviews.`;

  // TODO: wire up to your AI client
  // const response = await aiClient.complete(prompt);
  // return response.text;

  return `[AI summary pending — ${reviewCount} reviews, avg score ${avgScore}/10]`;
}

async function refreshChipscode(chipscode, productName) {
  // 1. Fetch pre-computed summary from reviews-service
  const summary = await rpc.call('summaryByProduct', {
    productCodes: [chipscode],
    brand: ['']
  });

  if (!summary || !summary[chipscode]) {
    console.log(`  No data for ${chipscode} — skipping`);
    return null;
  }

  const data = summary[chipscode];
  const avgScore = parseFloat(data.avg_score) || 0;
  const reviewCount = parseInt(data.review_count) || 0;
  const wouldBookAgainPercent = Math.round((data.avg_book_again_percent || 0) * 100);

  // 2. Get recent comment texts for AI summarisation
  const comments = Array.isArray(data.comments) ? data.comments : [];

  // 3. AI summarise
  const aiSummary = await summariseWithAI(
    productName, chipscode, avgScore, reviewCount, wouldBookAgainPercent, comments
  );

  return {
    chipscode,
    productName,
    summary: aiSummary,
    score: avgScore,
    scoreOutOf: 10,
    qualityLabel: qualityLabel(avgScore),
    totalReviews: reviewCount,
    reviewsUsedForSummary: Math.min(50, comments.length),
    wouldBookAgainPercent,
    lastUpdated: new Date().toISOString(),
    nextUpdateAt: new Date(Date.now() + 86400000).toISOString()
  };
}

async function run() {
  console.log(`[${new Date().toISOString()}] Starting daily review refresh`);

  // TODO: Replace with HXCM API call to get all active chipscodes
  // GET https://api.holidayextras.co.uk/v1/library/products?type=carpark
  // Each product has chipscode + base_product + product_name
  const chipscodes = [
    { chipscode: 'LGW9',  baseProduct: 'LGW', productName: 'Gatwick Long Stay North' },
    { chipscode: 'LGWP1', baseProduct: 'LGW', productName: 'Bloc Hotel Gatwick' },
    // ... fetch full list from HXCM
  ];

  const results = [];
  for (const product of chipscodes) {
    console.log(`  Processing ${product.chipscode}...`);
    try {
      const result = await refreshChipscode(product.chipscode, product.productName);
      if (result) results.push({ ...result, baseProduct: product.baseProduct });
    } catch (err) {
      console.error(`  Error processing ${product.chipscode}:`, err.message);
    }
  }

  // TODO: store results (database, cache, or flat JSON file)
  // await store.saveAll(results);

  console.log(`[${new Date().toISOString()}] Refresh complete. ${results.length}/${chipscodes.length} chipscodes updated.`);
}

run().catch(console.error);
