// src/client.ts
// Main ihyee API client.

import {
  AuthError,
  BadRequestError,
  IhyeeError,
  RateLimitError,
  ServerError,
} from './errors.js';
import type {
  ApiErrorBody,
  FetchOptions,
  FetchResponse,
  IhyeeOptions,
  RenderOptions,
  SearchOptions,
  SearchResponse,
} from './types.js';

const DEFAULT_BASE_URL = 'https://ihyee.delta-telematics.ca';
const DEFAULT_TIMEOUT = 60_000;

/**
 * Resolve the API key from explicit argument or environment variable.
 */
function resolveApiKey(apiKey?: string): string {
  if (apiKey) return apiKey;

  // process.env access guarded for non-Node environments
  const envKey =
    typeof process !== 'undefined' && process.env
      ? process.env.IHYEE_API_KEY
      : undefined;

  if (envKey) return envKey;

  throw new AuthError(
    'missing_key',
    'No API key provided. Pass apiKey in options or set IHYEE_API_KEY environment variable.',
    401,
  );
}

/**
 * Parse an error response and throw the appropriate typed error.
 */
async function handleErrors(response: Response): Promise<void> {
  if (response.ok) return;

  let code = 'unknown';
  let message: string;
  let retryAfter: number | undefined;

  try {
    const body = (await response.json()) as ApiErrorBody;
    code = body.error?.code ?? 'unknown';
    message = body.error?.message ?? response.statusText;
    retryAfter = body.error?.retry_after_seconds;
  } catch {
    message = response.statusText || `HTTP ${response.status}`;
  }

  const status = response.status;

  if (status === 429) {
    throw new RateLimitError(code, message, retryAfter);
  } else if (status === 401 || status === 403) {
    throw new AuthError(code, message, status);
  } else if (status === 400) {
    throw new BadRequestError(code, message, status);
  } else {
    throw new ServerError(code, message, status);
  }
}

/**
 * Convert camelCase option keys to snake_case for the API payload.
 */
function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (ch) => '_' + ch.toLowerCase());
}

/**
 * Build a JSON payload from required fields and optional camelCase options,
 * converting option keys to snake_case and omitting undefined values.
 */
function buildPayload(
  required: Record<string, unknown>,
  options?: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...required };
  if (options) {
    for (const [key, value] of Object.entries(options)) {
      if (value !== undefined) {
        payload[toSnakeCase(key)] = value;
      }
    }
  }
  return payload;
}

/**
 * Synchronous-style client for the ihyee web intelligence API.
 *
 * All methods return Promises (use `await`). Uses native `fetch()` — zero dependencies.
 *
 * @example
 * ```typescript
 * import { Ihyee } from 'ihyee';
 *
 * const client = new Ihyee({ apiKey: 'your_key' });
 * const results = await client.search('transformer architecture');
 * console.log(results.content[0].text?.summary);
 * ```
 */
export class Ihyee {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly timeout: number;

  constructor(options: IhyeeOptions = {}) {
    const apiKey = resolveApiKey(options.apiKey);
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Send a POST request to the API.
   */
  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      await handleErrors(response);
      return (await response.json()) as T;
    } catch (error: unknown) {
      if (error instanceof IhyeeError) throw error;
      if (
        error instanceof Error &&
        (error.name === 'AbortError' || error.name === 'TimeoutError')
      ) {
        throw new ServerError('timeout', `Request timed out after ${this.timeout}ms`, 408);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Search the web and return extracted content from top results.
   *
   * @param query - The search query string.
   * @param options - Optional search parameters.
   * @returns Typed search response with content items and metadata.
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResponse> {
    const payload = buildPayload(
      {
        query,
        max_results: options?.maxResults ?? 5,
        content_mode: options?.contentMode ?? 'both',
        render: options?.render ?? false,
        summarize_sentences: options?.summarizeSentences ?? 10,
      },
      {
        before: options?.before,
        after: options?.after,
        dateRestrict: options?.dateRestrict,
        mustHave: options?.mustHave,
        intext: options?.intext,
        andCondition: options?.andCondition,
      },
    );
    return this.post<SearchResponse>('/v1/search', payload);
  }

  /**
   * Fetch and extract content from specific URLs.
   *
   * @param urls - Array of URLs to fetch.
   * @param options - Optional fetch parameters.
   * @returns Typed fetch response with content items and metadata.
   */
  async fetch(urls: string[], options?: FetchOptions): Promise<FetchResponse> {
    const payload: Record<string, unknown> = {
      urls,
      content_mode: options?.contentMode ?? 'both',
      render: options?.render ?? false,
      summarize_sentences: options?.summarizeSentences ?? 10,
    };
    return this.post<FetchResponse>('/v1/fetch', payload);
  }

  /**
   * Force full browser rendering of a URL with Playwright.
   *
   * @param url - The URL to render.
   * @param options - Optional render parameters.
   * @returns Typed fetch response with content items and metadata.
   */
  async render(url: string, options?: RenderOptions): Promise<FetchResponse> {
    const payload = buildPayload(
      {
        url,
        wait_for: options?.waitFor ?? 'networkidle',
        timeout_ms: options?.timeoutMs ?? 30000,
        content_mode: options?.contentMode ?? 'both',
        summarize_sentences: options?.summarizeSentences ?? 10,
      },
      {
        waitSelector: options?.waitSelector,
      },
    );
    return this.post<FetchResponse>('/v1/render', payload);
  }
}
