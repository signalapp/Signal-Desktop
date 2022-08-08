// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import sharp from 'sharp';
import pify from 'pify';
import { readFile } from 'fs';
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

const STICKER_SIZE = 512;
const MIN_STICKER_DIMENSION = 10;
const MAX_STICKER_DIMENSION = STICKER_SIZE;
const MAX_STICKER_BYTE_LENGTH = 300 * 1024;

const { config } = SignalContext;

const WebAPI = initializeWebAPI({
  url: config.serverUrl,
  storageUrl: config.storageUrl,
  updatesUrl: config.updatesUrl,
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

function processStickerError(message: string, i18nKey: string): Error {
  const result = new Error(message);
  result.errorMessageI18nKey = i18nKey;
  return result;
}

window.processStickerImage = async (path: string | undefined) => {
  if (!path) {
    throw new Error(`Path ${path} is not valid!`);
  }

  const imgBuffer = await pify(readFile)(path);
  const sharpImg = sharp(imgBuffer);
  const meta = await sharpImg.metadata();

  const { width, height } = meta;
  if (!width || !height) {
    throw processStickerError(
      'Sticker height or width were falsy',
      'StickerCreator--Toasts--errorProcessing'
    );
  }

  let contentType;
  let processedBuffer;

  // [Sharp doesn't support APNG][0], so we do something simpler: validate the file size
  //   and dimensions without resizing, cropping, or converting. In a perfect world, we'd
  //   resize and convert any animated image (GIF, animated WebP) to APNG.
  // [0]: https://github.com/lovell/sharp/issues/2375
  const animatedPngDataIfExists = getAnimatedPngDataIfExists(imgBuffer);
  if (animatedPngDataIfExists) {
    if (imgBuffer.byteLength > MAX_STICKER_BYTE_LENGTH) {
      throw processStickerError(
        'Sticker file was too large',
        'StickerCreator--Toasts--tooLarge'
      );
    }
    if (width !== height) {
      throw processStickerError(
        'Sticker must be square',
        'StickerCreator--Toasts--APNG--notSquare'
      );
    }
    if (width > MAX_STICKER_DIMENSION) {
      throw processStickerError(
        'Sticker dimensions are too large',
        'StickerCreator--Toasts--APNG--dimensionsTooLarge'
      );
    }
    if (width < MIN_STICKER_DIMENSION) {
      throw processStickerError(
        'Sticker dimensions are too small',
        'StickerCreator--Toasts--APNG--dimensionsTooSmall'
      );
    }
    if (animatedPngDataIfExists.numPlays !== Infinity) {
      throw processStickerError(
        'Animated stickers must loop forever',
        'StickerCreator--Toasts--mustLoopForever'
      );
    }
    contentType = 'image/png';
    processedBuffer = imgBuffer;
  } else {
    contentType = 'image/webp';
    processedBuffer = await sharpImg
      .resize({
        width: STICKER_SIZE,
        height: STICKER_SIZE,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp()
      .toBuffer();
    if (processedBuffer.byteLength > MAX_STICKER_BYTE_LENGTH) {
      throw processStickerError(
        'Sticker file was too large',
        'StickerCreator--Toasts--tooLarge'
      );
    }
  }

  return {
    path,
    buffer: processedBuffer,
    src: `data:${contentType};base64,${processedBuffer.toString('base64')}`,
    meta,
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
  const iv = getRandomBytes(16);

  const server = WebAPI.connect({
    username,
    password,
    useWebSocket: false,
  });

  const uniqueStickers = uniqBy(
    [...stickers, { imageData: cover }],
    'imageData'
  );

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

  const coverStickerId =
    uniqueStickers.length === stickers.length ? 0 : uniqueStickers.length - 1;
  const coverStickerData = stickers[coverStickerId];
  const coverSticker = new Proto.StickerPack.Sticker();
  coverSticker.id = coverStickerId;
  if (coverStickerData.emoji) {
    coverSticker.emoji = coverStickerData.emoji;
  } else {
    coverSticker.emoji = '';
  }
  manifestProto.cover = coverSticker;

  const encryptedManifest = await encrypt(
    Proto.StickerPack.encode(manifestProto).finish(),
    encryptionKey,
    iv
  );
  const encryptedStickers = uniqueStickers.map(({ imageData }) => {
    if (!imageData?.buffer) {
      throw new Error('encryptStickers: Missing image data on sticker');
    }

    return encrypt(imageData.buffer, encryptionKey, iv);
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

function encrypt(
  data: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Uint8Array {
  const { ciphertext } = encryptAttachment(data, key, iv);

  return ciphertext;
}
