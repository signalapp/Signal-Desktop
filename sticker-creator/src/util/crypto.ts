// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import b64 from 'base64-js';

import type {
  Manifest,
  AnnotatedImage,
  EmojiData,
  ArtImageData,
} from '../types.d';
import { ArtType } from '../constants';
import { StickerPack } from './protos';
import { assert } from './assert';

export type EncryptOptions = Readonly<{
  artType: ArtType;
  manifest: Manifest;
  images: ReadonlyArray<AnnotatedImage>;
  cover: ArtImageData;
}>;

const encoder = new TextEncoder();

const PACK_KEY_SALT = new Uint8Array(32);
const PACK_KEY_SIZE = 32;
const PACK_KEY_STICKER_INFO = encoder.encode('Sticker Pack');
const PACK_KEY_AES_KEY_SIZE = 32;
const PACK_KEY_MAC_KEY_SIZE = 32;
const IV_SIZE = 16;
const MAC_SIZE = 32;
const RANDOM_STRING_SIZE = 32;

const BITS_PER_BYTE = 8;

export type EncryptAttachmentKeys = Readonly<{
  aesKey: CryptoKey;
  macKey: CryptoKey;
}>;

export type EncryptResult = Readonly<{
  encryptedManifest: Uint8Array;
  encryptedImages: ReadonlyArray<Uint8Array>;
  key: string;
}>;

export type DeriveKeysOptions = Readonly<{
  info: Uint8Array;
  secret: Uint8Array;
}>;

export async function deriveKeys({
  info,
  secret,
}: DeriveKeysOptions): Promise<EncryptAttachmentKeys> {
  const extractable = false;
  const baseKey = await crypto.subtle.importKey(
    'raw',
    secret,
    'HKDF',
    extractable,
    ['deriveBits']
  );

  const buffer = await crypto.subtle.deriveBits(
    {
      name: 'hkdf',
      hash: 'SHA-256',
      salt: PACK_KEY_SALT,
      info,
    },
    baseKey,
    BITS_PER_BYTE * (PACK_KEY_AES_KEY_SIZE + PACK_KEY_MAC_KEY_SIZE)
  );

  const rawAESKey = new Uint8Array(buffer, 0, PACK_KEY_AES_KEY_SIZE);
  const rawMacKey = new Uint8Array(
    buffer,
    PACK_KEY_AES_KEY_SIZE,
    PACK_KEY_MAC_KEY_SIZE
  );

  const aesKey = await crypto.subtle.importKey(
    'raw',
    rawAESKey,
    'AES-CBC',
    extractable,
    ['encrypt', 'decrypt']
  );
  const macKey = await crypto.subtle.importKey(
    'raw',
    rawMacKey,
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    extractable,
    ['sign', 'verify']
  );

  return { aesKey, macKey };
}

function toHex(bytes: Uint8Array): string {
  let str = '';
  for (const b of bytes) {
    let t = b.toString(16);
    if (t.length < 2) {
      t = `0${t}`;
    }
    str += t;
  }
  return str;
}

export async function encrypt({
  artType,
  manifest,
  images,
  cover,
}: EncryptOptions): Promise<EncryptResult> {
  const packKey = new Uint8Array(PACK_KEY_SIZE);

  crypto.getRandomValues(packKey);

  assert(artType === ArtType.Sticker, 'Unexpected art type');
  const info = PACK_KEY_STICKER_INFO;

  const keys = await deriveKeys({ info, secret: packKey });

  const imagesToUpload = new Array<Uint8Array>();
  const idByImage = new Map<string, number>();
  const emojiByImage = new Map<string, EmojiData>();
  for (const { emoji, buffer } of images) {
    const hex = toHex(buffer);
    if (!idByImage.get(hex)) {
      idByImage.set(hex, imagesToUpload.length);
      emojiByImage.set(hex, emoji);

      imagesToUpload.push(buffer);
    }
  }

  const coverHex = toHex(cover.buffer);
  let coverId = idByImage.get(coverHex);
  let coverEmoji: EmojiData | undefined;
  if (coverId === undefined) {
    coverId = imagesToUpload.length;
    imagesToUpload.push(cover.buffer);
  } else {
    coverEmoji = emojiByImage.get(coverHex);
  }

  const manifestProto = StickerPack.encode({
    title: manifest.title,
    author: manifest.author,
    stickers: images.map(({ emoji }, id) => {
      return {
        emoji: emoji.emoji,
        id,
      };
    }),
    cover: {
      id: coverId,
      emoji: coverEmoji?.emoji,
    },
  }).finish();

  const encryptedManifest = await encryptAttachment(manifestProto, keys);
  const encryptedImages = await Promise.all(
    imagesToUpload.map(image => {
      return encryptAttachment(image, keys);
    })
  );

  return {
    encryptedManifest,
    encryptedImages,
    key: toHex(packKey),
  };
}

export async function encryptAttachment(
  plaintext: Uint8Array,
  { aesKey, macKey }: EncryptAttachmentKeys
): Promise<Uint8Array> {
  const iv = new Uint8Array(IV_SIZE);
  crypto.getRandomValues(iv);

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: 'AES-CBC',
        iv,
      },
      aesKey,
      plaintext
    )
  );

  const ivAndCiphertext = new Uint8Array([...iv, ...ciphertext]);

  const mac = new Uint8Array(
    await crypto.subtle.sign(
      {
        name: 'HMAC',
      },
      macKey,
      ivAndCiphertext
    )
  );

  return new Uint8Array([...ivAndCiphertext, ...mac]);
}

export async function decryptAttachment(
  data: Uint8Array,
  { aesKey, macKey }: EncryptAttachmentKeys
): Promise<Uint8Array> {
  if (data.length < IV_SIZE + MAC_SIZE) {
    throw new Error('Attachment is too small');
  }

  const ivAndCipherText = data.slice(0, -MAC_SIZE);
  const mac = data.slice(-MAC_SIZE);

  const isValid = await crypto.subtle.verify(
    {
      name: 'HMAC',
    },
    macKey,
    mac,
    ivAndCipherText
  );

  if (!isValid) {
    throw new Error('Invalid mac');
  }

  const iv = ivAndCipherText.slice(0, IV_SIZE);
  const ciphertext = ivAndCipherText.slice(IV_SIZE);

  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: 'AES-CBC',
        iv,
      },
      aesKey,
      ciphertext
    )
  );

  return plaintext;
}

export function getRandomString(): string {
  const source = new Uint8Array(RANDOM_STRING_SIZE);
  crypto.getRandomValues(source);
  return b64.fromByteArray(source);
}
