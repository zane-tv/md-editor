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
export const generateShareUrl = (shareId: string, viewMode?: string): string => {
  const url = new URL(window.location.href);
  url.searchParams.delete('data');
  url.searchParams.delete('share');
  url.searchParams.set('s', shareId);
  if (viewMode) {
    url.searchParams.set('view', viewMode);
  } else {
    url.searchParams.delete('view');
  }
  return url.toString();
};

/**
 * Gets the share id from the URL if present.
 */
export const getShareIdFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('s') || params.get('share');
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

/**
 * Gets the view mode from the URL if present.
 */
export const getViewModeFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('view');
};
