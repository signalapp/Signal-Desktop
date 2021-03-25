// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global window */
const { ipcRenderer: ipc, remote } = require('electron');
const sharp = require('sharp');
const pify = require('pify');
const { readFile } = require('fs');
const config = require('url').parse(window.location.toString(), true).query;
const { noop, uniqBy } = require('lodash');
const pMap = require('p-map');
const client = require('libsignal-client');
const { deriveStickerPackKey } = require('../ts/Crypto');
const {
  getEnvironment,
  setEnvironment,
  parseEnvironment,
} = require('../ts/environment');
const { makeGetter } = require('../preload_utils');

const { dialog } = remote;
const { nativeTheme } = remote.require('electron');

const STICKER_SIZE = 512;
const MIN_STICKER_DIMENSION = 10;
const MAX_STICKER_DIMENSION = STICKER_SIZE;
const MAX_WEBP_STICKER_BYTE_LENGTH = 100 * 1024;
const MAX_ANIMATED_STICKER_BYTE_LENGTH = 300 * 1024;

setEnvironment(parseEnvironment(config.environment));

window.sqlInitializer = require('../ts/sql/initialize');

window.ROOT_PATH = window.location.href.startsWith('file') ? '../../' : '/';
window.PROTO_ROOT = '../../protos';
window.getEnvironment = getEnvironment;
window.getVersion = () => config.version;
window.getGuid = require('uuid/v4');
window.PQueue = require('p-queue').default;
window.Backbone = require('backbone');

window.localeMessages = ipc.sendSync('locale-data');

require('../ts/logging/set_up_renderer_logging').initialize();

require('../ts/LibSignalStore');

window.log.info('sticker-creator starting up...');

const Signal = require('../js/modules/signal');

window.Signal = Signal.setup({});
window.textsecure = require('../ts/textsecure').default;

window.libsignal = window.libsignal || {};
window.libsignal.HKDF = {};
window.libsignal.HKDF.deriveSecrets = (input, salt, info) => {
  const hkdf = client.HKDF.new(3);
  const output = hkdf.deriveSecrets(
    3 * 32,
    Buffer.from(input),
    Buffer.from(info),
    Buffer.from(salt)
  );
  return [output.slice(0, 32), output.slice(32, 64), output.slice(64, 96)];
};
window.synchronousCrypto = require('../ts/util/synchronousCrypto');

const { initialize: initializeWebAPI } = require('../ts/textsecure/WebAPI');
const {
  getAnimatedPngDataIfExists,
} = require('../ts/util/getAnimatedPngDataIfExists');

const WebAPI = initializeWebAPI({
  url: config.serverUrl,
  storageUrl: config.storageUrl,
  directoryUrl: config.directoryUrl,
  directoryEnclaveId: config.directoryEnclaveId,
  directoryTrustAnchor: config.directoryTrustAnchor,
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
    if (imgBuffer.byteLength > MAX_ANIMATED_STICKER_BYTE_LENGTH) {
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
    if (processedBuffer.byteLength > MAX_WEBP_STICKER_BYTE_LENGTH) {
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
  window.sqlInitializer.goBackToMainProcess();
  const usernameItem = await window.Signal.Data.getItemById('uuid_id');
  const oldUsernameItem = await window.Signal.Data.getItemById('number_id');
  const passwordItem = await window.Signal.Data.getItemById('password');

  if (!oldUsernameItem || !passwordItem) {
    const { message } = window.localeMessages[
      'StickerCreator--Authentication--error'
    ];

    dialog.showMessageBox({
      type: 'warning',
      message,
    });

    throw new Error(message);
  }

  const { value: username } = usernameItem;
  const { value: oldUsername } = oldUsernameItem;
  const { value: password } = passwordItem;

  const packKey = window.libsignal.crypto.getRandomBytes(32);
  const encryptionKey = await deriveStickerPackKey(packKey);
  const iv = window.libsignal.crypto.getRandomBytes(16);

  const server = WebAPI.connect({
    username: username || oldUsername,
    password,
  });

  const uniqueStickers = uniqBy(
    [...stickers, { imageData: cover }],
    'imageData'
  );

  const manifestProto = new window.textsecure.protobuf.StickerPack();
  manifestProto.title = manifest.title;
  manifestProto.author = manifest.author;
  manifestProto.stickers = stickers.map(({ emoji }, id) => {
    const s = new window.textsecure.protobuf.StickerPack.Sticker();
    s.id = id;
    s.emoji = emoji;

    return s;
  });
  const coverSticker = new window.textsecure.protobuf.StickerPack.Sticker();
  coverSticker.id =
    uniqueStickers.length === stickers.length ? 0 : uniqueStickers.length - 1;
  coverSticker.emoji = '';
  manifestProto.cover = coverSticker;

  const encryptedManifest = await encrypt(
    manifestProto.toArrayBuffer(),
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

  const hexKey = window.Signal.Crypto.hexFromBytes(packKey);

  ipc.send('install-sticker-pack', packId, hexKey);

  return { packId, key: hexKey };
};

async function encrypt(data, key, iv) {
  const { ciphertext } = await window.textsecure.crypto.encryptAttachment(
    data instanceof ArrayBuffer
      ? data
      : window.Signal.Crypto.typedArrayToArrayBuffer(data),
    key,
    iv
  );

  return ciphertext;
}

const getThemeSetting = makeGetter('theme-setting');

async function resolveTheme() {
  const theme = (await getThemeSetting()) || 'system';
  if (process.platform === 'darwin' && theme === 'system') {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
  return theme;
}

async function applyTheme() {
  window.document.body.classList.remove('dark-theme');
  window.document.body.classList.remove('light-theme');
  window.document.body.classList.add(`${await resolveTheme()}-theme`);
}

window.addEventListener('DOMContentLoaded', applyTheme);

nativeTheme.on('updated', () => {
  applyTheme();
});

window.log.info('sticker-creator preload complete...');
