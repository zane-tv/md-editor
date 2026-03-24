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
export const generateShareUrl = (content: string, viewMode?: string): string => {
  const compressed = compressToPath(content);
  const url = new URL(window.location.href);
  url.searchParams.set('data', compressed);
  if (viewMode) {
    url.searchParams.set('view', viewMode);
  }
  return url.toString();
};

/**
 * Shortens a URL using LNK API.
 * Falls back to the original URL if the API request fails.
 */
export const shortenUrl = async (longUrl: string): Promise<string> => {
  try {
    // LNK API requires valid URLs starting with http:// or https://
    // If we're running locally without http/https (e.g., file:// or some local test env),
    // the API will reject it with "The link field must be a valid URL."
    if (!longUrl.startsWith('http://') && !longUrl.startsWith('https://')) {
      console.warn('LNK API requires a valid http/https URL. Skipping shortening.');
      return longUrl;
    }

    const apiKey = import.meta.env.VITE_LNK_API_KEY || 'public';
    const response = await fetch('https://lnk.ua/api/v1/link/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ link: longUrl }),
    });

    const data = await response.json();

    // Check if the API returned a validation error (e.g. 422 Unprocessable Entity, or error inside 'result')
    if (data && data.result && data.result.errors) {
       console.error('LNK API Validation Error:', data.result.message || data.result.errors);
       return longUrl;
    }

    if (!response.ok) {
      console.error('Failed to shorten link via LNK API. Status:', response.status, data);
      return longUrl;
    }

    if (data && data.result && data.result.lnk) {
      return data.result.lnk;
    }

    console.error('Invalid response format from LNK API:', data);
    return longUrl;
  } catch (error) {
    console.error('Error shortening link:', error);
    return longUrl;
  }
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
