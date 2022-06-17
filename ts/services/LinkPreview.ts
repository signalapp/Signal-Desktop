// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce, omit } from 'lodash';

import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type {
  LinkPreviewImage,
  LinkPreviewResult,
  LinkPreviewSourceType,
} from '../types/LinkPreview';
import type { StickerPackType as StickerPackDBType } from '../sql/Interface';
import type { MIMEType } from '../types/MIME';
import * as Bytes from '../Bytes';
import * as LinkPreview from '../types/LinkPreview';
import * as Stickers from '../types/Stickers';
import * as VisualAttachment from '../types/VisualAttachment';
import * as log from '../logging/log';
import { IMAGE_JPEG, IMAGE_WEBP, stringToMIMEType } from '../types/MIME';
import { SECOND } from '../util/durations';
import { autoScale } from '../util/handleImageAttachment';
import { dropNull } from '../util/dropNull';
import { fileToBytes } from '../util/fileToBytes';
import { maybeParseUrl } from '../util/url';
import { sniffImageMimeType } from '../util/sniffImageMimeType';

const LINK_PREVIEW_TIMEOUT = 60 * SECOND;

let currentlyMatchedLink: string | undefined;
let disableLinkPreviews = false;
let excludedPreviewUrls: Array<string> = [];
let linkPreviewAbortController: AbortController | undefined;
let linkPreviewResult: Array<LinkPreviewResult> | undefined;

export function suspendLinkPreviews(): void {
  disableLinkPreviews = true;
}

export function hasLinkPreviewLoaded(): boolean {
  return Boolean(linkPreviewResult);
}

export const maybeGrabLinkPreview = debounce(_maybeGrabLinkPreview, 200);

function _maybeGrabLinkPreview(
  message: string,
  source: LinkPreviewSourceType,
  caretLocation?: number
): void {
  // Don't generate link previews if user has turned them off
  if (!window.Events.getLinkPreviewSetting()) {
    return;
  }

  // Do nothing if we're offline
  const { messaging } = window.textsecure;
  if (!messaging) {
    return;
  }
  // If we're behind a user-configured proxy, we don't support link previews
  if (window.isBehindProxy()) {
    return;
  }

  if (!message) {
    resetLinkPreview();
    return;
  }

  if (disableLinkPreviews) {
    return;
  }

  const links = LinkPreview.findLinks(message, caretLocation);
  if (currentlyMatchedLink && links.includes(currentlyMatchedLink)) {
    return;
  }

  currentlyMatchedLink = undefined;
  excludedPreviewUrls = excludedPreviewUrls || [];

  const link = links.find(
    item =>
      LinkPreview.shouldPreviewHref(item) && !excludedPreviewUrls.includes(item)
  );
  if (!link) {
    removeLinkPreview();
    return;
  }

  addLinkPreview(link, source);
}

export function resetLinkPreview(): void {
  disableLinkPreviews = false;
  excludedPreviewUrls = [];
  removeLinkPreview();
}

export function removeLinkPreview(): void {
  (linkPreviewResult || []).forEach((item: LinkPreviewResult) => {
    if (item.url) {
      URL.revokeObjectURL(item.url);
    }
  });
  linkPreviewResult = undefined;
  currentlyMatchedLink = undefined;
  linkPreviewAbortController?.abort();
  linkPreviewAbortController = undefined;

  window.reduxActions.linkPreviews.removeLinkPreview();
}

export async function addLinkPreview(
  url: string,
  source: LinkPreviewSourceType
): Promise<void> {
  if (currentlyMatchedLink === url) {
    log.warn('addLinkPreview should not be called with the same URL like this');
    return;
  }

  (linkPreviewResult || []).forEach((item: LinkPreviewResult) => {
    if (item.url) {
      URL.revokeObjectURL(item.url);
    }
  });
  window.reduxActions.linkPreviews.removeLinkPreview();
  linkPreviewResult = undefined;

  // Cancel other in-flight link preview requests.
  if (linkPreviewAbortController) {
    log.info(
      'addLinkPreview: canceling another in-flight link preview request'
    );
    linkPreviewAbortController.abort();
  }

  const thisRequestAbortController = new AbortController();
  linkPreviewAbortController = thisRequestAbortController;

  const timeout = setTimeout(() => {
    thisRequestAbortController.abort();
  }, LINK_PREVIEW_TIMEOUT);

  currentlyMatchedLink = url;
  // Adding just the URL so that we get into a "loading" state
  window.reduxActions.linkPreviews.addLinkPreview(
    {
      url,
    },
    source
  );

  try {
    const result = await getPreview(url, thisRequestAbortController.signal);

    if (!result) {
      log.info(
        'addLinkPreview: failed to load preview (not necessarily a problem)'
      );

      // This helps us disambiguate between two kinds of failure:
      //
      // 1. We failed to fetch the preview because of (1) a network failure (2) an
      //    invalid response (3) a timeout
      // 2. We failed to fetch the preview because we aborted the request because the
      //    user changed the link (e.g., by continuing to type the URL)
      const failedToFetch = currentlyMatchedLink === url;
      if (failedToFetch) {
        excludedPreviewUrls.push(url);
        removeLinkPreview();
      }
      return;
    }

    if (result.image && result.image.data) {
      const blob = new Blob([result.image.data], {
        type: result.image.contentType,
      });
      result.image.url = URL.createObjectURL(blob);
    } else if (!result.title) {
      // A link preview isn't worth showing unless we have either a title or an image
      removeLinkPreview();
      return;
    }

    window.reduxActions.linkPreviews.addLinkPreview(
      {
        ...result,
        description: dropNull(result.description),
        date: dropNull(result.date),
        domain: LinkPreview.getDomain(result.url),
        isStickerPack: LinkPreview.isStickerPack(result.url),
      },
      source
    );
    linkPreviewResult = [result];
  } catch (error) {
    log.error(
      'Problem loading link preview, disabling.',
      error && error.stack ? error.stack : error
    );
    disableLinkPreviews = true;
    removeLinkPreview();
  } finally {
    clearTimeout(timeout);
  }
}

export function getLinkPreviewForSend(message: string): Array<LinkPreviewType> {
  // Don't generate link previews if user has turned them off
  if (!window.storage.get('linkPreviews', false)) {
    return [];
  }

  if (!linkPreviewResult) {
    return [];
  }

  const urlsInMessage = new Set<string>(LinkPreview.findLinks(message));

  return (
    linkPreviewResult
      // This bullet-proofs against sending link previews for URLs that are no longer in
      //   the message. This can happen if you have a link preview, then quickly delete
      //   the link and send the message.
      .filter(({ url }: Readonly<{ url: string }>) => urlsInMessage.has(url))
      .map((item: LinkPreviewResult) => {
        if (item.image) {
          // We eliminate the ObjectURL here, unneeded for send or save
          return {
            ...item,
            image: omit(item.image, 'url'),
            description: dropNull(item.description),
            date: dropNull(item.date),
            domain: LinkPreview.getDomain(item.url),
            isStickerPack: LinkPreview.isStickerPack(item.url),
          };
        }

        return {
          ...item,
          description: dropNull(item.description),
          date: dropNull(item.date),
          domain: LinkPreview.getDomain(item.url),
          isStickerPack: LinkPreview.isStickerPack(item.url),
        };
      })
  );
}

async function getPreview(
  url: string,
  abortSignal: Readonly<AbortSignal>
): Promise<null | LinkPreviewResult> {
  const { messaging } = window.textsecure;

  if (!messaging) {
    throw new Error('messaging is not available!');
  }

  if (LinkPreview.isStickerPack(url)) {
    return getStickerPackPreview(url, abortSignal);
  }
  if (LinkPreview.isGroupLink(url)) {
    return getGroupPreview(url, abortSignal);
  }

  // This is already checked elsewhere, but we want to be extra-careful.
  if (!LinkPreview.shouldPreviewHref(url)) {
    return null;
  }

  const linkPreviewMetadata = await messaging.fetchLinkPreviewMetadata(
    url,
    abortSignal
  );
  if (!linkPreviewMetadata || abortSignal.aborted) {
    return null;
  }
  const { title, imageHref, description, date } = linkPreviewMetadata;

  let image;
  if (imageHref && LinkPreview.shouldPreviewHref(imageHref)) {
    let objectUrl: void | string;
    try {
      const fullSizeImage = await messaging.fetchLinkPreviewImage(
        imageHref,
        abortSignal
      );
      if (abortSignal.aborted) {
        return null;
      }
      if (!fullSizeImage) {
        throw new Error('Failed to fetch link preview image');
      }

      // Ensure that this file is either small enough or is resized to meet our
      //   requirements for attachments
      const withBlob = await autoScale({
        contentType: fullSizeImage.contentType,
        file: new Blob([fullSizeImage.data], {
          type: fullSizeImage.contentType,
        }),
        fileName: title,
      });

      const data = await fileToBytes(withBlob.file);
      objectUrl = URL.createObjectURL(withBlob.file);

      const blurHash = await window.imageToBlurHash(withBlob.file);

      const dimensions = await VisualAttachment.getImageDimensions({
        objectUrl,
        logger: log,
      });

      image = {
        data,
        size: data.byteLength,
        ...dimensions,
        contentType: stringToMIMEType(withBlob.file.type),
        blurHash,
      };
    } catch (error) {
      // We still want to show the preview if we failed to get an image
      log.error(
        'getPreview failed to get image for link preview:',
        error.message
      );
    } finally {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    }
  }

  if (abortSignal.aborted) {
    return null;
  }

  return {
    date: date || null,
    description: description || null,
    image,
    title,
    url,
  };
}

async function getStickerPackPreview(
  url: string,
  abortSignal: Readonly<AbortSignal>
): Promise<null | LinkPreviewResult> {
  const isPackDownloaded = (
    pack?: StickerPackDBType
  ): pack is StickerPackDBType => {
    if (!pack) {
      return false;
    }

    return pack.status === 'downloaded' || pack.status === 'installed';
  };
  const isPackValid = (pack?: StickerPackDBType): pack is StickerPackDBType => {
    if (!pack) {
      return false;
    }
    return (
      pack.status === 'ephemeral' ||
      pack.status === 'downloaded' ||
      pack.status === 'installed'
    );
  };

  const dataFromLink = Stickers.getDataFromLink(url);
  if (!dataFromLink) {
    return null;
  }
  const { id, key } = dataFromLink;

  try {
    const keyBytes = Bytes.fromHex(key);
    const keyBase64 = Bytes.toBase64(keyBytes);

    const existing = Stickers.getStickerPack(id);
    if (!isPackDownloaded(existing)) {
      await Stickers.downloadEphemeralPack(id, keyBase64);
    }

    if (abortSignal.aborted) {
      return null;
    }

    const pack = Stickers.getStickerPack(id);

    if (!isPackValid(pack)) {
      return null;
    }
    if (pack.key !== keyBase64) {
      return null;
    }

    const { title, coverStickerId } = pack;
    const sticker = pack.stickers[coverStickerId];
    const data =
      pack.status === 'ephemeral'
        ? await window.Signal.Migrations.readTempData(sticker.path)
        : await window.Signal.Migrations.readStickerData(sticker.path);

    if (abortSignal.aborted) {
      return null;
    }

    let contentType: MIMEType;
    const sniffedMimeType = sniffImageMimeType(data);
    if (sniffedMimeType) {
      contentType = sniffedMimeType;
    } else {
      log.warn(
        'getStickerPackPreview: Unable to sniff sticker MIME type; falling back to WebP'
      );
      contentType = IMAGE_WEBP;
    }

    return {
      date: null,
      description: null,
      image: {
        ...sticker,
        data,
        size: data.byteLength,
        contentType,
      },
      title,
      url,
    };
  } catch (error) {
    log.error(
      'getStickerPackPreview error:',
      error && error.stack ? error.stack : error
    );
    return null;
  } finally {
    if (id) {
      await Stickers.removeEphemeralPack(id);
    }
  }
}

async function getGroupPreview(
  url: string,
  abortSignal: Readonly<AbortSignal>
): Promise<null | LinkPreviewResult> {
  const urlObject = maybeParseUrl(url);
  if (!urlObject) {
    return null;
  }

  const { hash } = urlObject;
  if (!hash) {
    return null;
  }
  const groupData = hash.slice(1);

  const { inviteLinkPassword, masterKey } =
    window.Signal.Groups.parseGroupLink(groupData);

  const fields = window.Signal.Groups.deriveGroupFields(
    Bytes.fromBase64(masterKey)
  );
  const id = Bytes.toBase64(fields.id);
  const logId = `groupv2(${id})`;
  const secretParams = Bytes.toBase64(fields.secretParams);

  log.info(`getGroupPreview/${logId}: Fetching pre-join state`);
  const result = await window.Signal.Groups.getPreJoinGroupInfo(
    inviteLinkPassword,
    masterKey
  );

  if (abortSignal.aborted) {
    return null;
  }

  const title =
    window.Signal.Groups.decryptGroupTitle(result.title, secretParams) ||
    window.i18n('unknownGroup');
  const description =
    result.memberCount === 1 || result.memberCount === undefined
      ? window.i18n('GroupV2--join--member-count--single')
      : window.i18n('GroupV2--join--member-count--multiple', {
          count: result.memberCount.toString(),
        });
  let image: undefined | LinkPreviewImage;

  if (result.avatar) {
    try {
      const data = await window.Signal.Groups.decryptGroupAvatar(
        result.avatar,
        secretParams
      );
      image = {
        data,
        size: data.byteLength,
        contentType: IMAGE_JPEG,
        blurHash: await window.imageToBlurHash(
          new Blob([data], {
            type: IMAGE_JPEG,
          })
        ),
      };
    } catch (error) {
      const errorString = error && error.stack ? error.stack : error;
      log.error(
        `getGroupPreview/${logId}: Failed to fetch avatar ${errorString}`
      );
    }
  }

  if (abortSignal.aborted) {
    return null;
  }

  return {
    date: null,
    description,
    image,
    title,
    url,
  };
}
