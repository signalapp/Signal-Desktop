// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function extractImageUrl(url: string): string {
  const parsed = new URL(url);

  // Handle Bing image URLs
  if (
    parsed.hostname === 'www.bing.com' &&
    parsed.pathname === '/images/search' &&
    parsed.searchParams.has('view') &&
    parsed.searchParams.get('view') === 'detailV2' &&
    parsed.searchParams.has('mediaurl')
  ) {
    const mediaurl = parsed.searchParams.get('mediaurl');
    if (mediaurl) {
      try {
        const decoded = decodeURIComponent(mediaurl);

        // Check if it still contains encoded characters that need another decode
        if (decoded.includes('%')) {
          const doubleDecoded = decodeURIComponent(decoded);
          return doubleDecoded;
        }

        return decoded;
      } catch (e) {
        // If double decoding fails, return single decoded version
        return decodeURIComponent(mediaurl);
      }
    }
  }

  // Handle dragging from Google images without opening image preview
  if (
    parsed.hostname === 'www.google.com' &&
    parsed.pathname === '/imgres' &&
    parsed.searchParams.has('imgurl')
  ) {
    const imgurl = parsed.searchParams.get('imgurl');
    if (imgurl) {
      try {
        const decoded = decodeURIComponent(imgurl);

        if (decoded.includes('%')) {
          const doubleDecoded = decodeURIComponent(decoded);
          return doubleDecoded;
        }
        return decoded;
      } catch (e) {
        return decodeURIComponent(imgurl);
      }
    }
  }

  // Handle dragging from Google images preview
  if (
    parsed.hostname === 'www.google.com' &&
    parsed.pathname === '/url' &&
    parsed.searchParams.has('sa') &&
    parsed.searchParams.get('sa') === 'i'
  ) {
    // Try imgurl param first (most reliable)
    const imgurl = parsed.searchParams.get('imgurl');

    if (imgurl) {
      try {
        const decoded = decodeURIComponent(imgurl);

        if (decoded.includes('%')) {
          const doubleDecoded = decodeURIComponent(decoded);
          return doubleDecoded;
        }
        return decoded;
      } catch (e) {
        return decodeURIComponent(imgurl);
      }
    }

    // Fallback: try url param
    const directUrl = parsed.searchParams.get('url');
    if (directUrl) {
      const decoded = decodeURIComponent(directUrl);
      return decoded;
    }
  }

  return url;
}
