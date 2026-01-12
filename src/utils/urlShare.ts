import LZString from 'lz-string';

/**
 * Compresses the markdown content into a URL-safe string.
 */
export const compressToPath = (content: string): string => {
  return LZString.compressToEncodedURIComponent(content);
};

/**
 * Decompresses the URL-safe string back to markdown content.
 * Returns null if decompression fails.
 */
export const decompressFromPath = (compressed: string): string | null => {
  return LZString.decompressFromEncodedURIComponent(compressed);
};

/**
 * Generates the full shareable URL.
 */
export const generateShareUrl = (content: string): string => {
  const compressed = compressToPath(content);
  const url = new URL(window.location.href);
  url.searchParams.set('data', compressed);
  return url.toString();
};

/**
 * Checks the URL for shared content and returns it if present.
 */
export const checkUrlForSharedContent = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  const data = params.get('data');
  if (data) {
    return decompressFromPath(data);
  }
  return null;
};
