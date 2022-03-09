// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window */
const { ipcRenderer: ipc } = require('electron');
const sharp = require('sharp');
const pify = require('pify');
const { readFile } = require('fs');
const config = require('url').parse(window.location.toString(), true).query;
const { noop, uniqBy } = require('lodash');
const pMap = require('p-map');

// It is important to call this as early as possible
const { SignalContext } = require('../ts/windows/context');

window.i18n = SignalContext.i18n;

const {
  deriveStickerPackKey,
  encryptAttachment,
  getRandomBytes,
} = require('../ts/Crypto');
const Bytes = require('../ts/Bytes');
const { SignalService: Proto } = require('../ts/protobuf');
const { getEnvironment } = require('../ts/environment');
const { createSetting } = require('../ts/util/preload');

const STICKER_SIZE = 512;
const MIN_STICKER_DIMENSION = 10;
const MAX_STICKER_DIMENSION = STICKER_SIZE;
const MAX_STICKER_BYTE_LENGTH = 300 * 1024;

window.ROOT_PATH = window.location.href.startsWith('file') ? '../../' : '/';
window.getEnvironment = getEnvironment;
window.getVersion = () => config.version;
window.PQueue = require('p-queue').default;
window.Backbone = require('backbone');

window.localeMessages = ipc.sendSync('locale-data');

require('../ts/SignalProtocolStore');

SignalContext.log.info('sticker-creator starting up...');

const Signal = require('../js/modules/signal');

window.Signal = Signal.setup({});
window.textsecure = require('../ts/textsecure').default;

const { initialize: initializeWebAPI } = require('../ts/textsecure/WebAPI');
const {
  getAnimatedPngDataIfExists,
} = require('../ts/util/getAnimatedPngDataIfExists');

const WebAPI = initializeWebAPI({
  url: config.serverUrl,
  storageUrl: config.storageUrl,
  updatesUrl: config.updatesUrl,
  directoryVersion: parseInt(config.directoryVersion, 10),
  directoryUrl: config.directoryUrl,
  directoryEnclaveId: config.directoryEnclaveId,
  directoryTrustAnchor: config.directoryTrustAnchor,
  directoryV2Url: config.directoryV2Url,
  directoryV2PublicKey: config.directoryV2PublicKey,
  directoryV2CodeHashes: (config.directoryV2CodeHashes || '').split(','),
  cdnUrlObject: {
    0: config.cdnUrl0,
    2: config.cdnUrl2,
  },
  certificateAuthority: config.certificateAuthority,
  contentProxyUrl: config.contentProxyUrl,
  proxyUrl: config.proxyUrl,
  version: config.version,
});

function processStickerError(message, i18nKey) {
  const result = new Error(message);
  result.errorMessageI18nKey = i18nKey;
  return result;
}

window.processStickerImage = async path => {
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

  if (!oldUsernameItem || !passwordItem) {
    const { message } =
      window.localeMessages['StickerCreator--Authentication--error'];

    ipc.send('show-message-box', {
      type: 'warning',
      message,
    });

    throw new Error(message);
  }

  const { value: username } = usernameItem;
  const { value: oldUsername } = oldUsernameItem;
  const { value: password } = passwordItem;

  const packKey = getRandomBytes(32);
  const encryptionKey = deriveStickerPackKey(packKey);
  const iv = getRandomBytes(16);

  const server = WebAPI.connect({
    username: username || oldUsername,
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
    s.emoji = emoji;

    return s;
  });
  const coverSticker = new Proto.StickerPack.Sticker();
  coverSticker.id =
    uniqueStickers.length === stickers.length ? 0 : uniqueStickers.length - 1;
  coverSticker.emoji = '';
  manifestProto.cover = coverSticker;

  const encryptedManifest = await encrypt(
    Proto.StickerPack.encode(manifestProto).finish(),
    encryptionKey,
    iv
  );
  const encryptedStickers = await pMap(
    uniqueStickers,
    ({ imageData }) => encrypt(imageData.buffer, encryptionKey, iv),
    {
      concurrency: 3,
      timeout: 1000 * 60 * 2,
    }
  );

  const packId = await server.putStickers(
    encryptedManifest,
    encryptedStickers,
    onProgress
  );

  const hexKey = Bytes.toHex(packKey);

  ipc.send('install-sticker-pack', packId, hexKey);

  return { packId, key: hexKey };
};

async function encrypt(data, key, iv) {
  const { ciphertext } = await encryptAttachment(data, key, iv);

  return ciphertext;
}

const getThemeSetting = createSetting('themeSetting');

async function resolveTheme() {
  const theme = (await getThemeSetting.getValue()) || 'system';
  if (process.platform === 'darwin' && theme === 'system') {
    return SignalContext.nativeThemeListener.getSystemTheme();
  }
  return theme;
}

async function applyTheme() {
  window.document.body.classList.remove('dark-theme');
  window.document.body.classList.remove('light-theme');
  window.document.body.classList.add(`${await resolveTheme()}-theme`);
}

window.addEventListener('DOMContentLoaded', applyTheme);

SignalContext.nativeThemeListener.subscribe(() => applyTheme());

SignalContext.log.info('sticker-creator preload complete...');
