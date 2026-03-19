// tests/client.test.ts
// Tests for the Ihyee client with mocked fetch.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Ihyee, IhyeeError, AuthError, RateLimitError, BadRequestError, ServerError } from '../src/index.js';
import type { SearchResponse, FetchResponse } from '../src/index.js';

// --- Mock response fixtures (match Python SDK's conftest.py) ---

const MOCK_SEARCH_RESPONSE: SearchResponse = {
  query: 'test query',
  results_count: 1,
  content: [
    {
      type: 'text',
      url: 'https://example.com',
      text: {
        full_text: 'Full article content here.',
        summary: 'A short summary.',
        author: 'Test Author',
        date_published: '2025-06-15',
        links: [{ url: 'https://ref.com', text: 'Reference' }],
      },
    },
  ],
  meta: {
    search_time_ms: 850,
    pages_fetched: 1,
    pages_rendered: 0,
    content_mode: 'both',
    degraded: false,
  },
};

const MOCK_FETCH_RESPONSE: FetchResponse = {
  content: [
    {
      type: 'text',
      url: 'https://example.com',
      text: {
        summary: 'Fetched summary',
        author: 'Unknown',
        date_published: 'Unknown',
        links: [],
      },
    },
  ],
  meta: {
    pages_fetched: 1,
    pages_rendered: 0,
    content_mode: 'both',
    degraded: false,
  },
};

const MOCK_ERROR_401 = { error: { code: 'invalid_key', message: 'Invalid API key' } };
const MOCK_ERROR_429 = {
  error: {
    code: 'rate_limit_exceeded',
    message: 'Rate limit exceeded',
    retry_after_seconds: 30,
  },
};
const MOCK_ERROR_400 = {
  error: { code: 'bad_request', message: 'Missing required field: query' },
};

// --- Helpers ---

const BASE = 'https://mock.ihyee.test';

function mockFetchResponse(status: number, body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  } as Response);
}

// --- Tests ---

describe('Ihyee client', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('accepts explicit apiKey', () => {
      const client = new Ihyee({ apiKey: 'test_key', baseUrl: BASE });
      expect(client).toBeDefined();
    });

    it('reads apiKey from IHYEE_API_KEY env var', () => {
      const original = process.env.IHYEE_API_KEY;
      process.env.IHYEE_API_KEY = 'env_key';
      try {
        const client = new Ihyee({ baseUrl: BASE });
        expect(client).toBeDefined();
      } finally {
        if (original === undefined) {
          delete process.env.IHYEE_API_KEY;
        } else {
          process.env.IHYEE_API_KEY = original;
        }
      }
    });

    it('throws AuthError when no apiKey is available', () => {
      const original = process.env.IHYEE_API_KEY;
      delete process.env.IHYEE_API_KEY;
      try {
        expect(() => new Ihyee({ baseUrl: BASE })).toThrow(AuthError);
        expect(() => new Ihyee({ baseUrl: BASE })).toThrow(/No API key provided/);
      } finally {
        if (original !== undefined) {
          process.env.IHYEE_API_KEY = original;
        }
      }
    });
  });

  describe('search', () => {
    it('returns typed SearchResponse', async () => {
      globalThis.fetch = mockFetchResponse(200, MOCK_SEARCH_RESPONSE);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      const result = await client.search('test query');

      expect(result.results_count).toBe(1);
      expect(result.content[0].text?.summary).toBe('A short summary.');
      expect(result.content[0].text?.author).toBe('Test Author');
      expect(result.meta.search_time_ms).toBe(850);
    });

    it('sends correct payload with defaults', async () => {
      globalThis.fetch = mockFetchResponse(200, MOCK_SEARCH_RESPONSE);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      await client.search('ai research');

      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${BASE}/v1/search`);
      const body = JSON.parse(init.body as string);
      expect(body.query).toBe('ai research');
      expect(body.max_results).toBe(5);
      expect(body.content_mode).toBe('both');
      expect(body.render).toBe(false);
      expect(body.summarize_sentences).toBe(10);
    });

    it('sends correct payload with custom options', async () => {
      globalThis.fetch = mockFetchResponse(200, MOCK_SEARCH_RESPONSE);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      await client.search('ai research', {
        maxResults: 3,
        contentMode: 'summary',
        before: '2026-01-01',
        mustHave: 'transformer',
      });

      const body = JSON.parse(
        ((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit)
          .body as string,
      );
      expect(body.max_results).toBe(3);
      expect(body.content_mode).toBe('summary');
      expect(body.before).toBe('2026-01-01');
      expect(body.must_have).toBe('transformer');
    });

    it('omits undefined optional params', async () => {
      globalThis.fetch = mockFetchResponse(200, MOCK_SEARCH_RESPONSE);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      await client.search('test');

      const body = JSON.parse(
        ((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit)
          .body as string,
      );
      expect(body).not.toHaveProperty('before');
      expect(body).not.toHaveProperty('after');
      expect(body).not.toHaveProperty('must_have');
      expect(body).not.toHaveProperty('date_restrict');
      expect(body).not.toHaveProperty('intext');
      expect(body).not.toHaveProperty('and_condition');
    });

    it('sends Authorization header', async () => {
      globalThis.fetch = mockFetchResponse(200, MOCK_SEARCH_RESPONSE);
      const client = new Ihyee({ apiKey: 'my_secret_key', baseUrl: BASE });

      await client.search('test');

      const init = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
      expect((init.headers as Record<string, string>).Authorization).toBe(
        'Bearer my_secret_key',
      );
    });
  });

  describe('fetch', () => {
    it('returns typed FetchResponse', async () => {
      globalThis.fetch = mockFetchResponse(200, MOCK_FETCH_RESPONSE);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      const result = await client.fetch(['https://example.com']);

      expect(result.meta.pages_fetched).toBe(1);
      expect(result.content[0].text?.summary).toBe('Fetched summary');
    });

    it('sends urls array in payload', async () => {
      globalThis.fetch = mockFetchResponse(200, MOCK_FETCH_RESPONSE);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      await client.fetch(['https://a.com', 'https://b.com'], { contentMode: 'full_text' });

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${BASE}/v1/fetch`);
      const body = JSON.parse(init.body as string);
      expect(body.urls).toEqual(['https://a.com', 'https://b.com']);
      expect(body.content_mode).toBe('full_text');
    });
  });

  describe('render', () => {
    it('returns typed FetchResponse', async () => {
      globalThis.fetch = mockFetchResponse(200, MOCK_FETCH_RESPONSE);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      const result = await client.render('https://spa.example.com');

      expect(result.content).toHaveLength(1);
    });

    it('sends correct render payload', async () => {
      globalThis.fetch = mockFetchResponse(200, MOCK_FETCH_RESPONSE);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      await client.render('https://spa.example.com', {
        waitFor: 'domcontentloaded',
        waitSelector: '#content',
        timeoutMs: 15000,
      });

      const body = JSON.parse(
        ((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit)
          .body as string,
      );
      expect(body.url).toBe('https://spa.example.com');
      expect(body.wait_for).toBe('domcontentloaded');
      expect(body.wait_selector).toBe('#content');
      expect(body.timeout_ms).toBe(15000);
    });

    it('omits wait_selector when not provided', async () => {
      globalThis.fetch = mockFetchResponse(200, MOCK_FETCH_RESPONSE);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      await client.render('https://spa.example.com');

      const body = JSON.parse(
        ((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit)
          .body as string,
      );
      expect(body).not.toHaveProperty('wait_selector');
    });
  });

  describe('error handling', () => {
    it('throws AuthError on 401', async () => {
      globalThis.fetch = mockFetchResponse(401, MOCK_ERROR_401);
      const client = new Ihyee({ apiKey: 'bad', baseUrl: BASE });

      await expect(client.search('test')).rejects.toThrow(AuthError);
      try {
        await client.search('test');
      } catch (e) {
        expect(e).toBeInstanceOf(AuthError);
        expect((e as AuthError).code).toBe('invalid_key');
        expect((e as AuthError).statusCode).toBe(401);
      }
    });

    it('throws RateLimitError on 429 with retryAfter', async () => {
      globalThis.fetch = mockFetchResponse(429, MOCK_ERROR_429);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      try {
        await client.fetch(['https://example.com']);
        expect.unreachable('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(RateLimitError);
        expect((e as RateLimitError).retryAfter).toBe(30);
        expect((e as RateLimitError).statusCode).toBe(429);
      }
    });

    it('throws BadRequestError on 400', async () => {
      globalThis.fetch = mockFetchResponse(400, MOCK_ERROR_400);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      await expect(client.search('')).rejects.toThrow(BadRequestError);
    });

    it('throws ServerError on 502', async () => {
      globalThis.fetch = mockFetchResponse(502, {
        error: { code: 'upstream_failed', message: 'Upstream error' },
      });
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      await expect(client.fetch(['https://example.com'])).rejects.toThrow(ServerError);
    });

    it('handles non-JSON error body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      } as unknown as Response);
      const client = new Ihyee({ apiKey: 'key', baseUrl: BASE });

      try {
        await client.search('test');
        expect.unreachable('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ServerError);
        expect((e as ServerError).code).toBe('unknown');
      }
    });

    it('error classes have correct instanceof chain', () => {
      const auth = new AuthError('code', 'msg', 401);
      expect(auth).toBeInstanceOf(AuthError);
      expect(auth).toBeInstanceOf(IhyeeError);
      expect(auth).toBeInstanceOf(Error);

      const rate = new RateLimitError('code', 'msg', 30);
      expect(rate).toBeInstanceOf(RateLimitError);
      expect(rate).toBeInstanceOf(IhyeeError);

      const bad = new BadRequestError('code', 'msg');
      expect(bad).toBeInstanceOf(BadRequestError);
      expect(bad).toBeInstanceOf(IhyeeError);

      const server = new ServerError('code', 'msg');
      expect(server).toBeInstanceOf(ServerError);
      expect(server).toBeInstanceOf(IhyeeError);
    });
  });
});
