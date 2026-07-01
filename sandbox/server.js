/**
 * Review Insights API — Sandbox
 * Pure Node.js, no dependencies. Runs on http://localhost:3020
 */

const http = require('http');

function qualityLabel(score) {
  if (score >= 8.5) return 'Excellent';
  if (score >= 7.0) return 'Good';
  if (score >= 5.0) return 'Mixed';
  return 'Poor';
}

function now() { return new Date().toISOString(); }
function tomorrow() { return new Date(Date.now() + 86400000).toISOString(); }

const store = {
  'LGW9': {
    chipscode: 'LGW9', baseProduct: 'LGW', productName: 'Gatwick Long Stay North',
    summary: 'Customers rate this car park very highly. The shuttle bus is consistently praised for being frequent and reliable. A few reviewers mention the walk from the bus drop-off can be long with heavy luggage, but the majority say the process was smooth and stress-free.',
    score: 8.7, scoreOutOf: 10, totalReviews: 1423, reviewsUsedForSummary: 50, wouldBookAgainPercent: 94,
    lastUpdated: '2026-07-01T06:00:00Z'
  },
  'LGWP1': {
    chipscode: 'LGWP1', baseProduct: 'LGW', productName: 'Bloc Hotel Gatwick',
    summary: 'Reviewers love the location directly in the South Terminal. Rooms are described as compact but well designed. Check-in is praised as fast. Some mention noise from the terminal but most say it did not affect their stay.',
    score: 9.1, scoreOutOf: 10, totalReviews: 876, reviewsUsedForSummary: 50, wouldBookAgainPercent: 97,
    lastUpdated: '2026-07-01T06:00:00Z'
  },
  'LGWH1': {
    chipscode: 'LGWH1', baseProduct: 'LGW', productName: 'Hilton London Gatwick Airport',
    summary: 'A reliable choice for pre-flight stays. Staff are frequently praised for being helpful and the breakfast buffet gets good reviews. Rooms are described as comfortable if a little dated. The direct terminal link is consistently called out as the main selling point.',
    score: 8.2, scoreOutOf: 10, totalReviews: 643, reviewsUsedForSummary: 50, wouldBookAgainPercent: 88,
    lastUpdated: '2026-07-01T06:00:00Z'
  },
  'MAN1': {
    chipscode: 'MAN1', baseProduct: 'MAN', productName: 'Manchester Airport Car Park 1',
    summary: 'Reviews are mixed. The price is consistently praised as good value. However a number of reviewers mention the shuttle bus wait can be unpredictable, and a few report issues with the payment machines on arrival. The majority still say they would book again.',
    score: 6.8, scoreOutOf: 10, totalReviews: 2104, reviewsUsedForSummary: 50, wouldBookAgainPercent: 72,
    lastUpdated: '2026-07-01T06:00:00Z'
  },
  'MANL1': {
    chipscode: 'MANL1', baseProduct: 'MAN', productName: 'Aspire Lounge Manchester T1',
    summary: 'Customers consistently describe this lounge as a great start to their trip. Food and drink selection gets strong praise. Staff are described as welcoming. A few reviewers say it can get busy during peak hours but still rate the experience highly.',
    score: 9.3, scoreOutOf: 10, totalReviews: 512, reviewsUsedForSummary: 50, wouldBookAgainPercent: 98,
    lastUpdated: '2026-07-01T06:00:00Z'
  }
};

const rawReviews = {
  'LGW9': [
    { reviewId: 'rev_001', rating: 9, commentText: 'Great shuttle service, very frequent. Would definitely use again.', wouldBookProduct: true, wouldBookService: true, brand: 'HX', createdAt: '2026-06-15T10:22:00Z' },
    { reviewId: 'rev_002', rating: 8, commentText: 'Good value, easy process. Shuttle slightly long wait at peak time.', wouldBookProduct: true, wouldBookService: true, brand: 'HX', createdAt: '2026-06-10T08:11:00Z' },
    { reviewId: 'rev_003', rating: 10, commentText: 'Absolutely seamless. Best Gatwick parking option by far.', wouldBookProduct: true, wouldBookService: true, brand: 'HX', createdAt: '2026-06-08T14:33:00Z' },
    { reviewId: 'rev_004', rating: 7, commentText: 'Good car park but the walk to the terminal from the bus stop is quite far with bags.', wouldBookProduct: true, wouldBookService: false, brand: 'HX', createdAt: '2026-06-01T09:00:00Z' },
    { reviewId: 'rev_005', rating: 9, commentText: 'Used many times, always reliable. Easy drop off and quick bus.', wouldBookProduct: true, wouldBookService: true, brand: 'HX', createdAt: '2026-05-28T11:45:00Z' },
  ]
};

function send(res, status, body) {
  const json = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(json);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:3020');
  const path = url.pathname;

  // GET /reviews/:chipscode/summary
  const summaryMatch = path.match(/^\/reviews\/([^/]+)\/summary$/);
  if (summaryMatch) {
    const chipscode = summaryMatch[1].toUpperCase();
    const product = store[chipscode];
    if (!product) return send(res, 404, { error: 'NOT_FOUND', message: `No summary found for chipscode: ${chipscode}` });
    return send(res, 200, {
      ...product,
      qualityLabel: qualityLabel(product.score),
      nextUpdateAt: tomorrow()
    });
  }

  // GET /reviews/summary?chipscodes=X,Y,Z
  if (path === '/reviews/summary') {
    const codes = (url.searchParams.get('chipscodes') || '').split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    if (!codes.length) return send(res, 400, { error: 'BAD_REQUEST', message: 'chipscodes query param required' });
    const summaries = codes.map(code => {
      const p = store[code];
      if (!p) return { chipscode: code, error: 'NOT_FOUND' };
      return { ...p, qualityLabel: qualityLabel(p.score) };
    });
    return send(res, 200, { summaries, generatedAt: now() });
  }

  // GET /reviews/base/:baseProduct/summary
  const baseMatch = path.match(/^\/reviews\/base\/([^/]+)\/summary$/);
  if (baseMatch) {
    const base = baseMatch[1].toUpperCase();
    const products = Object.values(store).filter(p => p.baseProduct === base);
    if (!products.length) return send(res, 404, { error: 'NOT_FOUND', message: `No products found for base: ${base}` });
    return send(res, 200, {
      baseProduct: base,
      location: base === 'LGW' ? 'London Gatwick' : base === 'MAN' ? 'Manchester Airport' : base,
      summaries: products.map(p => ({ ...p, qualityLabel: qualityLabel(p.score) })),
      generatedAt: now()
    });
  }

  // GET /reviews/:chipscode/raw
  const rawMatch = path.match(/^\/reviews\/([^/]+)\/raw$/);
  if (rawMatch) {
    const chipscode = rawMatch[1].toUpperCase();
    const product = store[chipscode];
    if (!product) return send(res, 404, { error: 'NOT_FOUND', message: `No reviews found for chipscode: ${chipscode}` });
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const highRatedOnly = url.searchParams.get('highRatedOnly') === 'true';
    let reviews = rawReviews[chipscode] || [];
    if (highRatedOnly) reviews = reviews.filter(r => r.rating >= 8);
    reviews = reviews.slice(0, limit);
    return send(res, 200, { chipscode, totalReviews: product.totalReviews, reviews });
  }

  if (path === '/health') return send(res, 200, { status: 'ok', service: 'review-insights-sandbox', time: now() });

  send(res, 404, { error: 'NOT_FOUND', message: `No route: ${req.method} ${path}` });
});

server.listen(3020, () => {
  console.log('Review Insights sandbox — http://localhost:3020');
  console.log('');
  console.log('Test chipscodes: LGW9, LGWP1, LGWH1, MAN1, MANL1');
  console.log('Test base products: LGW, MAN');
  console.log('');
  console.log('  curl http://localhost:3020/reviews/LGW9/summary');
  console.log('  curl "http://localhost:3020/reviews/summary?chipscodes=LGW9,LGWP1"');
  console.log('  curl http://localhost:3020/reviews/base/LGW/summary');
  console.log('  curl http://localhost:3020/reviews/LGW9/raw');
});
