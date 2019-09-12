/* global
  Signal,
  textsecure,
  StringView
*/

/* eslint-disable no-bitwise */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Signal = window.Signal || {};
  window.Signal.LinkPreviews = window.Signal.LinkPreviews || {};

  // A cache mapping url to fetched previews
  const previewCache = {};

  async function makeChunkedRequest(url) {
    const PARALLELISM = 3;
    const size = await textsecure.messaging.getProxiedSize(url);
    const chunks = await Signal.LinkPreviews.getChunkPattern(size);

    let results = [];
    const jobs = chunks.map(chunk => async () => {
      const { start, end } = chunk;

      const result = await textsecure.messaging.makeProxiedRequest(url, {
        start,
        end,
        returnArrayBuffer: true,
      });

      return {
        ...chunk,
        ...result,
      };
    });

    while (jobs.length > 0) {
      const activeJobs = [];
      for (let i = 0, max = PARALLELISM; i < max; i += 1) {
        if (!jobs.length) {
          break;
        }

        const job = jobs.shift();
        activeJobs.push(job());
      }

      // eslint-disable-next-line no-await-in-loop
      results = results.concat(await Promise.all(activeJobs));
    }

    if (!results.length) {
      throw new Error('No responses received');
    }

    const { contentType } = results[0];
    const data = Signal.LinkPreviews.assembleChunks(results);

    return {
      contentType,
      data,
    };
  }

  async function sha256(string) {
    const arraybuffer = new TextEncoder('utf-8').encode(string);
    const digest = await window.crypto.subtle.digest('SHA-256', arraybuffer);
    return StringView.arrayBufferToHex(digest);
  }

  // Wrapper function which utilizes cache
  async function getPreview(url, skipCache = false) {
    // If we have a request cached then use that
    if (!skipCache && url in previewCache) {
      return previewCache[url];
    }

    // Start the request
    const promise = _getPreview(url);
    previewCache[url] = promise;

    return promise;
  }

  async function _getPreview(url) {
    let html;
    try {
      html = await textsecure.messaging.makeProxiedRequest(url);
    } catch (error) {
      if (error.code >= 300) {
        return null;
      }
    }

    const title = Signal.LinkPreviews.getTitleMetaTag(html);
    const imageUrl = Signal.LinkPreviews.getImageMetaTag(html);

    let image;
    let objectUrl;
    try {
      if (imageUrl) {
        if (!Signal.LinkPreviews.isMediaLinkInWhitelist(imageUrl)) {
          const primaryDomain = Signal.LinkPreviews.getDomain(url);
          const imageDomain = Signal.LinkPreviews.getDomain(imageUrl);
          throw new Error(
            `imageUrl for domain ${primaryDomain} did not match media whitelist. Domain: ${imageDomain}`
          );
        }

        const data = await makeChunkedRequest(imageUrl);

        // Calculate dimensions
        const file = new Blob([data.data], {
          type: data.contentType,
        });
        objectUrl = URL.createObjectURL(file);

        const dimensions = await Signal.Types.VisualAttachment.getImageDimensions(
          {
            objectUrl,
            logger: window.log,
          }
        );

        image = {
          ...data,
          ...dimensions,
          contentType: file.type,
        };
      }
    } catch (error) {
      // We still want to show the preview if we failed to get an image
      window.log.error(
        'getPreview failed to get image for link preview:',
        error.message
      );
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }

    const hash = await sha256(url);

    return {
      title,
      url,
      image,
      hash,
    };
  }

  window.Signal.LinkPreviews.helper = {
    getPreview,
  };
})();
