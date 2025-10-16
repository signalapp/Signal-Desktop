// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import { CallLinkRootKey, CallLinkEpoch } from '@signalapp/ringrtc';
import type { LinkPreviewWithHydratedData } from '../types/message/LinkPreviews.std.js';
import type {
  LinkPreviewImage,
  LinkPreviewResult,
  LinkPreviewSourceType,
  MaybeGrabLinkPreviewOptionsType,
  AddLinkPreviewOptionsType,
} from '../types/LinkPreview.std.js';
import type { LinkPreviewImage as LinkPreviewFetchImage } from '../linkPreviews/linkPreviewFetch.preload.js';
import * as Errors from '../types/errors.std.js';
import type { StickerPackType as StickerPackDBType } from '../sql/Interface.std.js';
import type { MIMEType } from '../types/MIME.std.js';
import * as Bytes from '../Bytes.std.js';
import { sha256 } from '../Crypto.node.js';
import * as LinkPreview from '../types/LinkPreview.std.js';
import { getLinkPreviewSetting } from '../util/Settings.preload.js';
import { readTempData, readStickerData } from '../util/migrations.preload.js';
import * as Stickers from '../types/Stickers.preload.js';
import * as VisualAttachment from '../types/VisualAttachment.dom.js';
import { createLogger } from '../logging/log.std.js';
import {
  parseGroupLink,
  deriveGroupFields,
  getPreJoinGroupInfo,
  decryptGroupTitle,
  decryptGroupAvatar,
} from '../groups.preload.js';
import { IMAGE_JPEG, IMAGE_WEBP, stringToMIMEType } from '../types/MIME.std.js';
import { SECOND } from '../util/durations/index.std.js';
import { autoScale } from '../util/handleImageAttachment.preload.js';
import { dropNull } from '../util/dropNull.std.js';
import { fileToBytes } from '../util/fileToBytes.std.js';
import { imageToBlurHash } from '../util/imageToBlurHash.dom.js';
import { maybeParseUrl } from '../util/url.std.js';
import { sniffImageMimeType } from '../util/sniffImageMimeType.std.js';
import { drop } from '../util/drop.std.js';
import { calling } from './calling.preload.js';
import { getKeyAndEpochFromCallLink } from '../util/callLinks.std.js';
import { getRoomIdFromCallLink } from '../util/callLinksRingrtc.node.js';
import {
  fetchLinkPreviewImage,
  fetchLinkPreviewMetadata,
} from '../textsecure/WebAPI.preload.js';
import { itemStorage } from '../textsecure/Storage.preload.js';

const { debounce, omit } = lodash;

const log = createLogger('LinkPreview');
const { i18n } = window.SignalContext;

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
  {
    caretLocation,
    conversationId,
    mode = 'conversation',
  }: MaybeGrabLinkPreviewOptionsType = {}
): void {
  // Don't generate link previews if user has turned them off. When posting a
  // story we should return minimal (url-only) link previews.
  if (!getLinkPreviewSetting() && mode === 'conversation') {
    return;
  }

  if (!message) {
    resetLinkPreview(conversationId);
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
    removeLinkPreview(conversationId);
    return;
  }

  drop(
    addLinkPreview(link, source, {
      conversationId,
      disableFetch: !getLinkPreviewSetting(),
    })
  );
}

export function resetLinkPreview(conversationId?: string): void {
  disableLinkPreviews = false;
  excludedPreviewUrls = [];
  removeLinkPreview(conversationId);
}

export function removeLinkPreview(conversationId?: string): void {
  (linkPreviewResult || []).forEach((item: LinkPreviewResult) => {
    if (item.url) {
      URL.revokeObjectURL(item.url);
    }
  });
  linkPreviewResult = undefined;
  currentlyMatchedLink = undefined;
  linkPreviewAbortController?.abort();
  linkPreviewAbortController = undefined;

  window.reduxActions.linkPreviews.removeLinkPreview(conversationId);
}

export async function addLinkPreview(
  url: string,
  source: LinkPreviewSourceType,
  { conversationId, disableFetch }: AddLinkPreviewOptionsType = {}
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
  window.reduxActions.linkPreviews.removeLinkPreview(conversationId);
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
      isCallLink: false,
    },
    source,
    conversationId
  );

  try {
    let result: LinkPreviewResult | null;
    if (disableFetch) {
      result = {
        title: null,
        url,
        description: null,
        date: null,
      };
    } else {
      result = await getPreview(url, thisRequestAbortController.signal);
    }

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
        removeLinkPreview(conversationId);
      }
      return;
    }

    if (result.image && result.image.data) {
      const blob = new Blob([result.image.data], {
        type: result.image.contentType,
      });
      result.image.url = URL.createObjectURL(blob);
    } else if (!result.title && !disableFetch) {
      // A link preview isn't worth showing unless we have either a title or an image
      removeLinkPreview(conversationId);
      return;
    }

    window.reduxActions.linkPreviews.addLinkPreview(
      {
        ...result,
        title: dropNull(result.title),
        description: dropNull(result.description),
        date: dropNull(result.date),
        domain: LinkPreview.getDomain(result.url),
        isStickerPack: LinkPreview.isStickerPack(result.url),
        isCallLink: LinkPreview.isCallLink(result.url),
      },
      source,
      conversationId
    );
    linkPreviewResult = [result];
  } catch (error) {
    log.error(
      'Problem loading link preview, disabling.',
      Errors.toLogFormat(error)
    );
    disableLinkPreviews = true;
    removeLinkPreview(conversationId);
  } finally {
    clearTimeout(timeout);
  }
}

export function getLinkPreviewForSend(
  message: string
): Array<LinkPreviewWithHydratedData> {
  // Don't generate link previews if user has turned them off
  if (!itemStorage.get('linkPreviews', false)) {
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
      .map(sanitizeLinkPreview)
  );
}

export function sanitizeLinkPreview(
  item: LinkPreviewResult | LinkPreviewWithHydratedData
): LinkPreviewWithHydratedData {
  const isCallLink = LinkPreview.isCallLink(item.url);
  const base: LinkPreviewWithHydratedData = {
    ...item,
    title: dropNull(item.title),
    description: dropNull(item.description),
    date: dropNull(item.date),
    domain: LinkPreview.getDomain(item.url),
    isStickerPack: LinkPreview.isStickerPack(item.url),
    isCallLink,
    callLinkRoomId: isCallLink ? getRoomIdFromCallLink(item.url) : undefined,
  };

  if (item.image) {
    // We eliminate the ObjectURL here, unneeded for send or save
    return {
      ...base,
      image: omit(item.image, 'url'),
    };
  }

  return base;
}

async function getPreview(
  url: string,
  abortSignal: Readonly<AbortSignal>
): Promise<null | LinkPreviewResult> {
  if (LinkPreview.isStickerPack(url)) {
    return getStickerPackPreview(url, abortSignal);
  }
  if (LinkPreview.isGroupLink(url)) {
    return getGroupPreview(url, abortSignal);
  }
  if (LinkPreview.isCallLink(url)) {
    return getCallLinkPreview(url, abortSignal);
  }

  // This is already checked elsewhere, but we want to be extra-careful.
  if (!LinkPreview.shouldPreviewHref(url)) {
    return null;
  }

  const linkPreviewMetadata = await fetchLinkPreviewMetadata(url, abortSignal);
  if (!linkPreviewMetadata || abortSignal.aborted) {
    log.warn('aborted');
    return null;
  }
  const { title, image, description, date } = linkPreviewMetadata;

  let fetchedImage: LinkPreviewFetchImage | null;

  if (typeof image === 'string') {
    if (!LinkPreview.shouldPreviewHref(image)) {
      log.warn('refusing to fetch image from provided URL');
      fetchedImage = null;
    } else {
      try {
        const fullSizeImage = await fetchLinkPreviewImage(image, abortSignal);
        if (abortSignal.aborted) {
          return null;
        }
        if (!fullSizeImage) {
          throw new Error('Failed to fetch link preview image');
        }
        fetchedImage = fullSizeImage;
      } catch (error) {
        // We still want to show the preview if we failed to get an image
        log.warn(
          'getPreview failed to get image for link preview:',
          error.message
        );
        fetchedImage = null;
      }
    }
  } else {
    fetchedImage = image;
  }

  let imageAttachment: LinkPreviewImage | undefined;
  if (fetchedImage) {
    let objectUrl: undefined | string;
    try {
      // Ensure that this file is either small enough or is resized to meet our
      //   requirements for attachments
      const withBlob = await autoScale({
        contentType: fetchedImage.contentType,
        file: new Blob([fetchedImage.data], {
          type: fetchedImage.contentType,
        }),
        fileName: title,
        highQuality: true,
      });

      const data = await fileToBytes(withBlob.file);
      objectUrl = URL.createObjectURL(withBlob.file);

      const blurHash = await imageToBlurHash(withBlob.file);

      const dimensions = await VisualAttachment.getImageDimensions({
        objectUrl,
        logger: log,
      });

      imageAttachment = {
        data,
        size: data.byteLength,
        ...dimensions,
        plaintextHash: Bytes.toHex(sha256(data)),
        contentType: stringToMIMEType(withBlob.file.type),
        blurHash,
      };
    } catch (error) {
      // We still want to show the preview if we failed to get an image
      log.error(
        'getPreview failed to process image for link preview:',
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
    image: imageAttachment,
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
        ? await readTempData(sticker)
        : await readStickerData(sticker);

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
    log.error('getStickerPackPreview error:', Errors.toLogFormat(error));
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

  const { inviteLinkPassword, masterKey } = parseGroupLink(groupData);

  const fields = deriveGroupFields(Bytes.fromBase64(masterKey));
  const id = Bytes.toBase64(fields.id);
  const logId = `groupv2(${id})`;
  const secretParams = Bytes.toBase64(fields.secretParams);

  log.info(`getGroupPreview/${logId}: Fetching pre-join state`);
  const result = await getPreJoinGroupInfo(inviteLinkPassword, masterKey);

  if (abortSignal.aborted) {
    return null;
  }

  const title =
    decryptGroupTitle(dropNull(result.title), secretParams) ||
    i18n('icu:unknownGroup');
  const description = i18n('icu:GroupV2--join--group-metadata--full', {
    memberCount: result?.memberCount ?? 0,
  });
  let image: undefined | LinkPreviewImage;

  if (result.avatar) {
    try {
      const data = await decryptGroupAvatar(result.avatar, secretParams);
      image = {
        data,
        size: data.byteLength,
        contentType: IMAGE_JPEG,
        blurHash: await imageToBlurHash(
          new Blob([data], {
            type: IMAGE_JPEG,
          })
        ),
      };
    } catch (error) {
      const errorString = Errors.toLogFormat(error);
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

async function getCallLinkPreview(
  url: string,
  _abortSignal: Readonly<AbortSignal>
): Promise<null | LinkPreviewResult> {
  const { key, epoch } = getKeyAndEpochFromCallLink(url);
  const callLinkRootKey = CallLinkRootKey.parse(key);
  const callLinkEpoch = epoch ? CallLinkEpoch.parse(epoch) : undefined;
  const callLinkState = await calling.readCallLink(
    callLinkRootKey,
    callLinkEpoch
  );
  if (callLinkState == null || callLinkState.revoked) {
    return null;
  }

  return {
    url,
    title:
      callLinkState.name === ''
        ? i18n('icu:calling__call-link-default-title')
        : callLinkState.name,
    description: i18n('icu:message--call-link-description'),
    image: undefined,
    date: null,
  };
}
