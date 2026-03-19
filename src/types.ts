// src/types.ts
// TypeScript interfaces for the ihyee web intelligence API.

// --- Client options ---

/** Options for constructing an Ihyee client. */
export interface IhyeeOptions {
  /** API key for authentication. Falls back to IHYEE_API_KEY env var. */
  apiKey?: string;
  /** Base URL of the ihyee API. */
  baseUrl?: string;
  /** Request timeout in milliseconds. Default: 60000. */
  timeout?: number;
}

// --- Request options ---

/** Options for the search endpoint. */
export interface SearchOptions {
  /** Maximum number of results to return. Default: 5. */
  maxResults?: number;
  /** Content extraction mode. Default: 'both'. */
  contentMode?: 'both' | 'full_text' | 'summary';
  /** Whether to force browser rendering for all pages. */
  render?: boolean;
  /** Number of sentences in the summary. Default: 10. */
  summarizeSentences?: number;
  /** Only return results published before this date (YYYY-MM-DD). */
  before?: string;
  /** Only return results published after this date (YYYY-MM-DD). */
  after?: string;
  /** Google date restrict parameter (e.g., 'd7' for past week). */
  dateRestrict?: string;
  /** Exact phrase that must appear in results. */
  mustHave?: string;
  /** Term that must appear in the page text. */
  intext?: string;
  /** Additional AND condition for the search query. */
  andCondition?: string;
}

/** Options for the fetch endpoint. */
export interface FetchOptions {
  /** Content extraction mode. Default: 'both'. */
  contentMode?: 'both' | 'full_text' | 'summary';
  /** Whether to force browser rendering for all pages. */
  render?: boolean;
  /** Number of sentences in the summary. Default: 10. */
  summarizeSentences?: number;
}

/** Options for the render endpoint. */
export interface RenderOptions {
  /** When to consider the page loaded. Default: 'networkidle'. */
  waitFor?: 'networkidle' | 'domcontentloaded' | 'load';
  /** CSS selector to wait for before extracting content. */
  waitSelector?: string;
  /** Render timeout in milliseconds. Default: 30000. */
  timeoutMs?: number;
  /** Content extraction mode. Default: 'both'. */
  contentMode?: 'both' | 'full_text' | 'summary';
  /** Number of sentences in the summary. Default: 10. */
  summarizeSentences?: number;
}

// --- Response types (match API JSON exactly, snake_case) ---

/** A link extracted from page content. */
export interface ExtractedLink {
  url: string;
  text: string;
  context?: string;
}

/** Text content extracted from a page. */
export interface TextContent {
  full_text?: string;
  summary?: string;
  author: string;
  date_published: string;
  links: ExtractedLink[];
  error?: string;
}

/** An image found on a page. */
export interface ImageContent {
  url: string;
  alt: string;
}

/** A document (PDF, etc.) found at a URL. */
export interface DocumentContent {
  s3_url: string;
  original_url: string;
  content_type: string;
  size_bytes: number;
}

/** A single content item in a response. */
export interface ContentItem {
  type: 'text' | 'image_url' | 'document';
  url?: string;
  text?: TextContent;
  image_url?: ImageContent;
  document?: DocumentContent;
}

/** Metadata about the API response. */
export interface ResponseMeta {
  search_time_ms?: number;
  pages_fetched: number;
  pages_rendered: number;
  content_mode: string;
  degraded: boolean;
  render_skipped?: string;
}

/** Response from the search endpoint. */
export interface SearchResponse {
  query: string;
  results_count: number;
  content: ContentItem[];
  meta: ResponseMeta;
}

/** Response from the fetch and render endpoints. */
export interface FetchResponse {
  content: ContentItem[];
  meta: ResponseMeta;
}

/** Raw API error body shape. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    retry_after_seconds?: number;
  };
}
