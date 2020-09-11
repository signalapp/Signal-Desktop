/* global window */
const { ipcRenderer: ipc, remote } = require('electron');
const sharp = require('sharp');
const pify = require('pify');
const { readFile } = require('fs');
const config = require('url').parse(window.location.toString(), true).query;
const { noop, uniqBy } = require('lodash');
const pMap = require('p-map');
const { deriveStickerPackKey } = require('../ts/Crypto');
const { makeGetter } = require('../preload_utils');

const { dialog } = remote;
const { nativeTheme } = remote.require('electron');

window.ROOT_PATH = window.location.href.startsWith('file') ? '../../' : '/';
window.PROTO_ROOT = '../../protos';
window.getEnvironment = () => config.environment;
window.getVersion = () => config.version;
window.getGuid = require('uuid/v4');
window.PQueue = require('p-queue').default;

window.localeMessages = ipc.sendSync('locale-data');

require('../js/logging');

window.log.info('sticker-creator starting up...');

const Signal = require('../js/modules/signal');

window.Signal = Signal.setup({});
window.textsecure = require('../ts/textsecure').default;

const { initialize: initializeWebAPI } = require('../ts/textsecure/WebAPI');

const WebAPI = initializeWebAPI({
  url: config.serverUrl,
  storageUrl: config.storageUrl,
  cdnUrlObject: {
    '0': config.cdnUrl0,
    '2': config.cdnUrl2,
  },
  certificateAuthority: config.certificateAuthority,
  contentProxyUrl: config.contentProxyUrl,
  proxyUrl: config.proxyUrl,
  version: config.version,
});

window.convertToWebp = async (path, width = 512, height = 512) => {
  const imgBuffer = await pify(readFile)(path);
  const sharpImg = sharp(imgBuffer);
  const meta = await sharpImg.metadata();

  const buffer = await sharpImg
    .resize({
      width,
      height,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp()
    .toBuffer();

  return {
    path,
    buffer,
    src: `data:image/webp;base64,${buffer.toString('base64')}`,
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

  const uniqueStickers = uniqBy([...stickers, { webp: cover }], 'webp');

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
    ({ webp }) => encrypt(webp.buffer, encryptionKey, iv),
    { concurrency: 3 }
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
