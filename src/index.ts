// src/index.ts
// Public API surface for the ihyee SDK.

export { Ihyee } from './client.js';
export {
  IhyeeError,
  AuthError,
  RateLimitError,
  BadRequestError,
  ServerError,
} from './errors.js';
export type {
  IhyeeOptions,
  SearchOptions,
  FetchOptions,
  RenderOptions,
  SearchResponse,
  FetchResponse,
  ContentItem,
  TextContent,
  ImageContent,
  DocumentContent,
  ExtractedLink,
  ResponseMeta,
  ApiErrorBody,
} from './types.js';
