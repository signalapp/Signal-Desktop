// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile } from 'fs/promises';
import { noop, uniqBy } from 'lodash';
import { ipcRenderer as ipc } from 'electron';

import {
  deriveStickerPackKey,
  encryptAttachment,
  getRandomBytes,
} from '../../ts/Crypto';
import * as Bytes from '../../ts/Bytes';
import { SignalService as Proto } from '../../ts/protobuf';
import { initialize as initializeWebAPI } from '../../ts/textsecure/WebAPI';

import { SignalContext } from '../../ts/windows/context';
import { getAnimatedPngDataIfExists } from '../../ts/util/getAnimatedPngDataIfExists';
import { explodePromise } from '../../ts/util/explodePromise';

class ProcessStickerImageError extends Error {
  constructor(message: string, public readonly errorMessageI18nKey: string) {
    super(message);
  }
}
export type ProcessStickerImageErrorType = typeof ProcessStickerImageError;
window.ProcessStickerImageError = ProcessStickerImageError;

const STICKER_SIZE = 512;
const MIN_STICKER_DIMENSION = 10;
const MAX_STICKER_DIMENSION = STICKER_SIZE;
const MAX_STICKER_BYTE_LENGTH = 300 * 1024;

const { config } = SignalContext;

const WebAPI = initializeWebAPI({
  url: config.serverUrl,
  storageUrl: config.storageUrl,
  updatesUrl: config.updatesUrl,
  resourcesUrl: config.resourcesUrl,
  directoryConfig: config.directoryConfig,
  cdnUrlObject: {
    0: config.cdnUrl0,
    2: config.cdnUrl2,
  },
  certificateAuthority: config.certificateAuthority,
  contentProxyUrl: config.contentProxyUrl,
  proxyUrl: config.proxyUrl,
  version: config.version,
});

export type StickerImageData = Readonly<{
  buffer: Buffer;
  src: string;
  path: string;
}>;

async function loadImage(data: Buffer): Promise<HTMLImageElement> {
  const image = new Image();

  const { promise, resolve, reject } = explodePromise<void>();

  image.addEventListener('load', () => resolve());
  image.addEventListener('error', () => reject(new Error('Bad image')));
  image.src = `data:image/jpeg;base64,${data.toString('base64')}`;

  await promise;

  return image;
}

declare global {
  // eslint-disable-next-line no-restricted-syntax
  interface OffscreenCanvas {
    convertToBlob(options: { type: string; quality: number }): Promise<Blob>;
  }
}

window.processStickerImage = async function processStickerImage(
  path?: string
): Promise<StickerImageData> {
  if (!path) {
    throw new Error(`Path ${path} is not valid!`);
  }

  const imgBuffer = await readFile(path);

  const image = await loadImage(imgBuffer);
  const { naturalWidth: width, naturalHeight: height } = image;
  if (!width || !height) {
    throw new ProcessStickerImageError(
      'Sticker height or width were falsy',
      'StickerCreator--Toasts--errorProcessing'
    );
  }

  let contentType;
  let processedBuffer;

  // For APNG we do something simpler: validate the file size
  //   and dimensions without resizing, cropping, or converting. In a perfect world, we'd
  //   resize and convert any animated image (GIF, animated WebP) to APNG.
  const animatedPngDataIfExists = getAnimatedPngDataIfExists(imgBuffer);
  if (animatedPngDataIfExists) {
    if (imgBuffer.byteLength > MAX_STICKER_BYTE_LENGTH) {
      throw new ProcessStickerImageError(
        'Sticker file was too large',
        'StickerCreator--Toasts--tooLarge'
      );
    }
    if (width !== height) {
      throw new ProcessStickerImageError(
        'Sticker must be square',
        'StickerCreator--Toasts--APNG--notSquare'
      );
    }
    if (width > MAX_STICKER_DIMENSION) {
      throw new ProcessStickerImageError(
        'Sticker dimensions are too large',
        'StickerCreator--Toasts--APNG--dimensionsTooLarge'
      );
    }
    if (width < MIN_STICKER_DIMENSION) {
      throw new ProcessStickerImageError(
        'Sticker dimensions are too small',
        'StickerCreator--Toasts--APNG--dimensionsTooSmall'
      );
    }
    if (animatedPngDataIfExists.numPlays !== Infinity) {
      throw new ProcessStickerImageError(
        'Animated stickers must loop forever',
        'StickerCreator--Toasts--mustLoopForever'
      );
    }
    contentType = 'image/png';
    processedBuffer = imgBuffer;
  } else {
    const canvas = new OffscreenCanvas(STICKER_SIZE, STICKER_SIZE);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2d context of canvas');
    }

    const scaleFactor = STICKER_SIZE / Math.max(width, height);
    const newWidth = width * scaleFactor;
    const newHeight = height * scaleFactor;
    const dx = (STICKER_SIZE - newWidth) / 2;
    const dy = (STICKER_SIZE - newHeight) / 2;

    (context as OffscreenCanvasRenderingContext2D).drawImage(
      image,
      dx,
      dy,
      newWidth,
      newHeight
    );

    const blob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.8,
    });

    processedBuffer = Buffer.from(await blob.arrayBuffer());

    if (
      !processedBuffer ||
      processedBuffer.byteLength > MAX_STICKER_BYTE_LENGTH
    ) {
      throw new ProcessStickerImageError(
        'Sticker file was too large',
        'StickerCreator--Toasts--tooLarge'
      );
    }
  }

  return {
    path,
    buffer: processedBuffer,
    src: `data:${contentType};base64,${processedBuffer.toString('base64')}`,
  };
};

window.encryptAndUpload = async (
  manifest,
  stickers,
  cover,
  onProgress = noop
) => {
  const usernameItem = await window.Signal.Data.getItemById('uuid_id');
  const oldUsernameItem = await window.Signal.Data.getItemById('number_id');
  const passwordItem = await window.Signal.Data.getItemById('password');

  const username = usernameItem?.value || oldUsernameItem?.value;
  if (!username || !passwordItem?.value) {
    const { message } =
      window.localeMessages['StickerCreator--Authentication--error'];

    ipc.send('show-message-box', {
      type: 'warning',
      message,
    });

    throw new Error(message);
  }

  const { value: password } = passwordItem;

  const packKey = getRandomBytes(32);
  const encryptionKey = deriveStickerPackKey(packKey);

  const server = WebAPI.connect({
    username,
    password,
    useWebSocket: false,
    hasStoriesDisabled: true,
  });

  const manifestProto = new Proto.StickerPack();
  manifestProto.title = manifest.title;
  manifestProto.author = manifest.author;
  manifestProto.stickers = stickers.map(({ emoji }, id) => {
    const s = new Proto.StickerPack.Sticker();
    s.id = id;
    if (emoji) {
      s.emoji = emoji;
    }

    return s;
  });

  const uniqueStickers = uniqBy(
    [...stickers, { imageData: cover }],
    'imageData'
  );
  const coverStickerIndex = uniqueStickers.findIndex(
    item => item.imageData?.src === cover.src
  );
  const coverStickerId = coverStickerIndex >= 0 ? coverStickerIndex : 0;
  const coverStickerData = stickers[coverStickerId];

  if (!coverStickerData) {
    window.SignalContext.log.warn(
      'encryptAndUpload: No coverStickerData with ' +
        `index ${coverStickerId} and ${stickers.length} total stickers`
    );
  }

  const coverSticker = new Proto.StickerPack.Sticker();
  coverSticker.id = coverStickerId;

  if (coverStickerData?.emoji && coverSticker) {
    coverSticker.emoji = coverStickerData.emoji;
  } else {
    coverSticker.emoji = '';
  }

  manifestProto.cover = coverSticker;

  const encryptedManifest = await encrypt(
    Proto.StickerPack.encode(manifestProto).finish(),
    encryptionKey
  );
  const encryptedStickers = uniqueStickers.map(({ imageData }) => {
    if (!imageData?.buffer) {
      throw new Error('encryptStickers: Missing image data on sticker');
    }

    return encrypt(imageData.buffer, encryptionKey);
  });

  const packId = await server.putStickers(
    encryptedManifest,
    encryptedStickers,
    onProgress
  );

  const hexKey = Bytes.toHex(packKey);

  ipc.send('install-sticker-pack', packId, hexKey);

  return { packId, key: hexKey };
};

function encrypt(data: Uint8Array, key: Uint8Array): Uint8Array {
  const { ciphertext } = encryptAttachment(data, key);

  return ciphertext;
}
