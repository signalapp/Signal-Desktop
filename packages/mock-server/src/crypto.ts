// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import crypto from 'crypto';
import { Buffer } from 'buffer';
import {
  KEMPublicKey,
  PrivateKey,
  PublicKey,
  SenderCertificate,
  hkdf,
} from '@signalapp/libsignal-client';

import { signalservice as Proto } from '../protos/compiled';

import { Attachment } from './data/attachment';
import type { ServerSignedPreKey } from './data/schemas';
import { NEVER_EXPIRES, SERVER_CERTIFICATE_ID } from './constants';
import { AciString, DeviceId, KyberPreKey, SignedPreKey } from './types';
import { ReadonlyDeep } from 'type-fest';

const AES_KEY_SIZE = 32;
const MAC_KEY_SIZE = 32;
const AESGCM_IV_SIZE = 12;
const AUTH_TAG_SIZE = 16;
const MASTER_KEY_SIZE = 32;

export type EncryptedProvisionMessage = {
  body: Buffer<ArrayBuffer>;
  ephemeralKey: Buffer<ArrayBuffer>;
};

export type ServerCertificate = {
  privateKey: PrivateKey;
  certificate: Proto.ServerCertificate.Params;
};

export type Sender = {
  readonly aci: AciString;
  readonly number?: string;
  readonly deviceId: DeviceId;
  readonly identityKey: PublicKey;
  readonly expires?: number;
};

export function encryptProvisionMessage(
  data: Buffer<ArrayBuffer>,
  remotePubKey: PublicKey,
): EncryptedProvisionMessage {
  const privateKey = PrivateKey.generate();
  const publicKey = privateKey.getPublicKey();

  const agreement = privateKey.agree(remotePubKey);

  const secrets = hkdf(
    AES_KEY_SIZE + MAC_KEY_SIZE,
    agreement,
    Buffer.from('TextSecure Provisioning Message'),
    null,
  );

  const aesKey = secrets.slice(0, AES_KEY_SIZE);
  const macKey = secrets.slice(AES_KEY_SIZE);

  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

  const version = Buffer.from([1]);

  const ciphertext = Buffer.concat([version, iv, encrypted]);

  const mac = crypto.createHmac('sha256', macKey).update(ciphertext).digest();

  const body = Buffer.concat([ciphertext, mac]);

  return {
    body,
    ephemeralKey: Buffer.from(publicKey.serialize()),
  };
}

export type EncryptAttachmentOptions = Readonly<{
  aesKey: Buffer<ArrayBuffer>;
  macKey: Buffer<ArrayBuffer>;
  iv: Buffer<ArrayBuffer>;
}>;

export function encryptAttachment(
  cleartext: Buffer<ArrayBuffer>,
  { aesKey, macKey, iv }: EncryptAttachmentOptions = {
    aesKey: crypto.randomBytes(32),
    macKey: crypto.randomBytes(32),
    iv: crypto.randomBytes(16),
  },
): Attachment {
  const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
  const ciphertext = Buffer.concat([cipher.update(cleartext), cipher.final()]);

  const mac = crypto
    .createHmac('sha256', macKey)
    .update(iv)
    .update(ciphertext)
    .digest();

  const key = Buffer.concat([aesKey, macKey]);

  const blob = Buffer.concat([iv, ciphertext, mac]);

  const digest = crypto.createHash('sha256').update(blob).digest();

  return {
    key,
    blob,
    digest,
    size: cleartext.length,
  };
}

export function generateServerCertificate(
  rootKey: PrivateKey,
): ServerCertificate {
  const privateKey = PrivateKey.generate();

  const data = Buffer.from(
    Proto.ServerCertificate.Certificate.encode({
      id: SERVER_CERTIFICATE_ID,
      key: privateKey.getPublicKey().serialize(),
    }),
  );

  const signature = rootKey.sign(data);

  const certificate = {
    certificate: data,
    signature,
  };

  return {
    privateKey,
    certificate,
  };
}

export function generateSenderCertificate(
  serverCert: ServerCertificate,
  sender: Sender,
): SenderCertificate {
  const data = Buffer.from(
    Proto.SenderCertificate.Certificate.encode({
      senderE164: sender.number ?? null,
      senderUuid: sender.aci,
      senderDevice: sender.deviceId,
      expires: BigInt(sender.expires ?? NEVER_EXPIRES),
      identityKey: sender.identityKey.serialize(),
      signer: serverCert.certificate,
    }),
  );

  const signature = serverCert.privateKey.sign(data);

  const certificate = Buffer.from(
    Proto.SenderCertificate.encode({
      certificate: data,
      signature,
    }),
  );

  return SenderCertificate.deserialize(certificate);
}

export function deriveAccessKey(
  profileKey: Uint8Array<ArrayBuffer>,
): Buffer<ArrayBuffer> {
  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    profileKey,
    Buffer.alloc(12),
  );

  return Buffer.concat([cipher.update(Buffer.alloc(16)), cipher.final()]);
}

export function deriveMasterKey(
  accountEntropyPool: string,
): Buffer<ArrayBuffer> {
  return Buffer.from(
    hkdf(
      MASTER_KEY_SIZE,
      Buffer.from(accountEntropyPool),
      Buffer.from('20240801_SIGNAL_SVR_MASTER_KEY'),
      null,
    ),
  );
}

export function deriveStorageKey(
  masterKey: Buffer<ArrayBuffer>,
): Buffer<ArrayBuffer> {
  const hash = crypto.createHmac('sha256', masterKey);
  hash.update('Storage Service Encryption');
  return hash.digest();
}

function deriveStorageManifestKey(
  storageKey: Buffer<ArrayBuffer>,
  version: bigint,
): Buffer<ArrayBuffer> {
  const hash = crypto.createHmac('sha256', storageKey);
  hash.update(`Manifest_${version.toString()}`);
  return hash.digest();
}

const STORAGE_SERVICE_ITEM_KEY_INFO_PREFIX =
  '20240801_SIGNAL_STORAGE_SERVICE_ITEM_';
const STORAGE_SERVICE_ITEM_KEY_LEN = 32;

export type DeriveStorageItemKeyOptions = Readonly<{
  storageKey: Buffer<ArrayBuffer>;
  recordIkm: Buffer<ArrayBuffer> | undefined;
  key: Buffer<ArrayBuffer>;
}>;

export function deriveStorageItemKey({
  storageKey,
  recordIkm,
  key,
}: DeriveStorageItemKeyOptions): Buffer<ArrayBuffer> {
  if (recordIkm === undefined) {
    const hash = crypto.createHmac('sha256', storageKey);
    hash.update(`Item_${key.toString('base64')}`);
    return hash.digest();
  }

  return Buffer.from(
    hkdf(
      STORAGE_SERVICE_ITEM_KEY_LEN,
      recordIkm,
      Buffer.concat([Buffer.from(STORAGE_SERVICE_ITEM_KEY_INFO_PREFIX), key]),
      Buffer.alloc(0),
    ),
  );
}

function decryptAESGCM(
  ciphertext: Buffer<ArrayBuffer>,
  key: Buffer<ArrayBuffer>,
): Buffer<ArrayBuffer> {
  const iv = ciphertext.subarray(0, AESGCM_IV_SIZE);
  const tag = ciphertext.subarray(ciphertext.length - AUTH_TAG_SIZE);
  const rest = ciphertext.subarray(iv.length, ciphertext.length - tag.length);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);

  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(rest), decipher.final()]);
}

function encryptAESGCM(
  plaintext: Uint8Array<ArrayBuffer>,
  key: Uint8Array<ArrayBuffer>,
): Buffer<ArrayBuffer> {
  const iv = crypto.randomBytes(AESGCM_IV_SIZE);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = [cipher.update(plaintext), cipher.final()];

  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, ...ciphertext, tag]);
}

export function decryptStorageManifest(
  storageKey: Buffer<ArrayBuffer>,
  manifest: Proto.StorageManifest.Params,
): Proto.ManifestRecord {
  if (!manifest.value?.length) {
    throw new Error('Missing manifest.value');
  }

  const manifestKey = deriveStorageManifestKey(
    storageKey,
    manifest.version ?? 0n,
  );

  const decoded = Proto.ManifestRecord.decode(
    decryptAESGCM(Buffer.from(manifest.value), manifestKey),
  );

  if (decoded.version !== manifest.version) {
    throw new Error('manifestRecord.version != manifest.version');
  }

  return decoded;
}

export function encryptStorageManifest(
  storageKey: Buffer<ArrayBuffer>,
  manifestRecord: Proto.ManifestRecord.Params,
): Proto.StorageManifest.Params {
  if (!manifestRecord.version) {
    throw new Error('Missing manifest.version');
  }

  const manifestKey = deriveStorageManifestKey(
    storageKey,
    manifestRecord.version,
  );

  const encrypted = encryptAESGCM(
    Buffer.from(Proto.ManifestRecord.encode(manifestRecord)),
    manifestKey,
  );

  return {
    version: manifestRecord.version,
    value: encrypted,
  };
}

export type DecryptStorageItemOptions = Readonly<{
  storageKey: Buffer<ArrayBuffer>;
  recordIkm: Buffer<ArrayBuffer> | undefined;
  item: Proto.StorageItem.Params;
}>;

export function decryptStorageItem({
  storageKey,
  recordIkm,
  item,
}: DecryptStorageItemOptions): Proto.StorageRecord {
  if (!item.key) {
    throw new Error('Missing item.key');
  }
  if (!item.value) {
    throw new Error('Missing item.value');
  }

  const itemKey = deriveStorageItemKey({
    storageKey,
    recordIkm,
    key: Buffer.from(item.key),
  });

  return Proto.StorageRecord.decode(
    decryptAESGCM(Buffer.from(item.value), itemKey),
  );
}

export type EncryptStorageItemOptions = Readonly<{
  storageKey: Buffer<ArrayBuffer>;
  key: Buffer<ArrayBuffer>;
  recordIkm: Buffer<ArrayBuffer> | undefined;
  record: Proto.StorageRecord.Params;
}>;

export function encryptStorageItem({
  storageKey,
  key,
  recordIkm,
  record,
}: EncryptStorageItemOptions): Proto.StorageItem.Params {
  const itemKey = deriveStorageItemKey({
    storageKey,
    recordIkm,
    key,
  });

  const encrypted = encryptAESGCM(
    Buffer.from(Proto.StorageRecord.encode(record)),
    itemKey,
  );

  return {
    key,
    value: encrypted,
  };
}

export function encryptProfileName(
  profileKey: Uint8Array<ArrayBuffer>,
  name: string,
): Buffer<ArrayBuffer> {
  const encrypted = encryptAESGCM(Buffer.from(name), profileKey);

  return encrypted;
}

export function generateAccessKeyVerifier(
  accessKey: Buffer<ArrayBuffer>,
): Buffer<ArrayBuffer> {
  const zeroes = Buffer.alloc(32);

  return crypto.createHmac('sha256', accessKey).update(zeroes).digest();
}

export function decodeSignedPreKey({
  keyId,
  publicKey,
  signature,
}: ServerSignedPreKey): SignedPreKey {
  return {
    keyId,
    publicKey: PublicKey.deserialize(Buffer.from(publicKey, 'base64')),
    signature: Buffer.from(signature, 'base64'),
  };
}

export function decodeKyberPreKey({
  keyId,
  publicKey,
  signature,
}: ServerSignedPreKey): KyberPreKey {
  return {
    keyId,
    publicKey: KEMPublicKey.deserialize(Buffer.from(publicKey, 'base64')),
    signature: Buffer.from(signature, 'base64'),
  };
}

export function hashRemoteConfig(
  config: ReadonlyDeep<Array<[string, string]>>,
): Buffer<ArrayBuffer> {
  // Not necessarily secure, but this will let us detect changes. The exact
  // format isn't important so long as it's deterministic.
  const mac = crypto.createHmac('sha256', 'remoteConfig');
  return config
    .reduce(
      (mac, [name, value], index) =>
        mac
          .update(index.toString())
          .update(name.length.toString())
          .update(name)
          .update(value.length.toString())
          .update(value),
      mac,
    )
    .digest();
}
