# ihyee

[![npm](https://img.shields.io/npm/v/ihyee)](https://www.npmjs.com/package/ihyee)
[![Node](https://img.shields.io/node/v/ihyee)](https://www.npmjs.com/package/ihyee)
[![License](https://img.shields.io/npm/l/ihyee)](https://github.com/aizukanne/ihyee-js/blob/main/LICENSE)

**JavaScript/TypeScript SDK for the ihyee web intelligence API** — search, fetch, and understand any web page in one API call.

## Install

```bash
npm install ihyee
```

## Quick Start

```typescript
import { Ihyee } from 'ihyee';

const client = new Ihyee({ apiKey: 'your_api_key' });
const results = await client.search('transformer architecture', { maxResults: 3 });

for (const item of results.content) {
  if (item.type === 'text' && item.text) {
    console.log(item.text.summary);
  }
}
```

## Search

Search the web via Google and return extracted, summarized content from top results.

```typescript
const results = await client.search('latest AI research', {
  maxResults: 5,
  contentMode: 'both',       // 'both', 'full_text', or 'summary'
  before: '2026-01-01',      // date filters
  mustHave: 'transformer',   // exact phrase required
});

for (const item of results.content) {
  if (item.type === 'text') {
    console.log(`URL: ${item.url}`);
    console.log(`Summary: ${item.text?.summary}`);
    console.log(`Links: ${item.text?.links.length}`);
  } else if (item.type === 'image_url') {
    console.log(`Image: ${item.image_url?.url}`);
  }
}
```

## Fetch

Fetch and extract content from specific URLs. Automatically uses headless browser rendering for JavaScript-heavy pages.

```typescript
const results = await client.fetch(
  ['https://example.com/article', 'https://spa-app.com/page'],
  { contentMode: 'full_text' },
);
```

## Render

Force full browser rendering with Playwright. Use for SPAs and pages that require JavaScript.

```typescript
const results = await client.render('https://spa-app.com/dashboard', {
  waitFor: 'networkidle',
  waitSelector: '#content',
  timeoutMs: 30000,
});
```

## Error Handling

```typescript
import { Ihyee, AuthError, RateLimitError, IhyeeError } from 'ihyee';

try {
  const results = await client.search('query');
} catch (e) {
  if (e instanceof AuthError) {
    console.log('Invalid API key');
  } else if (e instanceof RateLimitError) {
    console.log(`Rate limited — retry after ${e.retryAfter}s`);
  } else if (e instanceof IhyeeError) {
    console.log(`API error ${e.code}: ${e.message}`);
  }
}
```

## Environment Variable

```bash
# Set IHYEE_API_KEY in your environment
export IHYEE_API_KEY=your_api_key
```

```typescript
// Then omit apiKey parameter
const client = new Ihyee();
```

## TypeScript

Full type definitions are included. All response types match the API JSON exactly (snake_case fields). Option parameters use camelCase for idiomatic JS/TS usage.

```typescript
import type {
  SearchResponse,
  FetchResponse,
  ContentItem,
  TextContent,
  ImageContent,
  DocumentContent,
  ExtractedLink,
  ResponseMeta,
} from 'ihyee';
```

## Requirements

- Node.js 18+ (uses native `fetch()`)
- Zero runtime dependencies

## Documentation

Full API docs: [ihyee.delta-telematics.ca/api-docs](https://ihyee.delta-telematics.ca/api-docs)

## License

MIT
