// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import b64 from 'base64-js';
import pLimit from 'p-limit';
import type { infer as zInfer } from 'zod';
import z from 'zod';

import { type ArtType } from '../constants';
import { type Credentials } from '../types.d';
import { type EncryptResult, getRandomString } from './crypto';

const MAX_PARALLEL_UPLOADS = 10;

declare global {
  // eslint-disable-next-line no-restricted-syntax
  interface Window {
    getCredentials(): Promise<Credentials>;
    installStickerPack(packId: string, key: string): void;
  }
}

export type UploadOptions = Readonly<{
  artType: ArtType;
  onProgress?: () => void;
}>;

export type UploadResult = Readonly<{
  key: string;
  packId: string;
}>;

async function getSchemas() {
  const UploadAttributes = z.object({
    acl: z.string(),
    algorithm: z.string(),
    credential: z.string(),
    date: z.string(),
    id: z.number(),
    key: z.string(),
    policy: z.string(),
    signature: z.string(),
    securityToken: z.string(),
  });

  const FormResponse = z.object({
    packId: z.string(),
    manifest: UploadAttributes,
    art: z.array(UploadAttributes),
    uploadURL: z.string(),
  });

  return { UploadAttributes, FormResponse };
}

type Schemas = Awaited<ReturnType<typeof getSchemas>>;

const encoder = new TextEncoder();

export class APIError extends Error {
  constructor(message: string, public readonly errorMessageI18nKey: string) {
    super(message);
  }
}

export async function upload(
  encryptResult: EncryptResult,
  { artType, onProgress }: UploadOptions
): Promise<UploadResult> {
  const {
    encryptedManifest: manifest,
    encryptedImages: images,
    key,
  } = encryptResult;

  const credentials = await window.getCredentials();
  const { baseUrl = '' } = credentials;

  const auth = b64.fromByteArray(
    encoder.encode([credentials.username, credentials.password].join(':'))
  );

  const res = await fetch(
    `${baseUrl}/api/form?artType=${artType}&artCount=${images.length}`,
    {
      headers: {
        authorization: `Basic ${auth}`,
      },
    }
  );

  if (res.status === 401 || res.status === 403) {
    throw new APIError(
      'Credentials expired',
      'StickerCreator--Toasts--expired-credenitals'
    );
  }

  if (!res.ok) {
    throw new Error(`Request failed, status: ${res.status}`);
  }

  const { FormResponse } = await getSchemas();

  const form = FormResponse.parse(await res.json());
  if (form.art.length !== images.length) {
    throw new Error('Invalid form data, image count mismatch');
  }

  const limiter = pLimit(MAX_PARALLEL_UPLOADS);

  await Promise.all([
    limiter(async () => {
      await uploadAttachment(form.uploadURL, form.manifest, manifest);
      onProgress?.();
    }),
    ...images.map((image, index) =>
      limiter(async () => {
        await uploadAttachment(form.uploadURL, form.art[index], image);
        onProgress?.();
      })
    ),
  ]);

  window.installStickerPack(form.packId, key);

  return {
    key,
    packId: form.packId,
  };
}

async function uploadAttachment(
  uploadURL: string,
  {
    key,
    credential,
    acl,
    algorithm,
    date,
    policy,
    signature,
    securityToken,
  }: zInfer<Schemas['UploadAttributes']>,
  encryptedData: Uint8Array
): Promise<void> {
  // Note: when using the boundary string in the POST body, it needs to be
  //   prefixed by an extra --, and the final boundary string at the end gets a
  //   -- prefix and a -- suffix.
  const boundaryString = getRandomString().replace(/=/g, '');
  const CRLF = '\r\n';
  const getSection = (name: string, value: string) =>
    [
      `--${boundaryString}`,
      `Content-Disposition: form-data; name="${name}"${CRLF}`,
      value,
    ].join(CRLF);

  const start = [
    getSection('key', key),
    getSection('x-amz-credential', credential),
    getSection('acl', acl),
    getSection('x-amz-algorithm', algorithm),
    getSection('x-amz-date', date),
    getSection('policy', policy),
    getSection('x-amz-signature', signature),
    getSection('x-amz-security-token', securityToken),
    getSection('Content-Type', 'application/octet-stream'),
    `--${boundaryString}`,
    'Content-Disposition: form-data; name="file"',
    `Content-Type: application/octet-stream${CRLF}${CRLF}`,
  ].join(CRLF);
  const end = `${CRLF}--${boundaryString}--${CRLF}`;

  const startBuffer = encoder.encode(start);
  const endBuffer = encoder.encode(end);

  const contentLength =
    startBuffer.length + encryptedData.length + endBuffer.length;
  const body = new Uint8Array(contentLength);
  body.set(startBuffer, 0);
  body.set(encryptedData, startBuffer.length);
  body.set(endBuffer, startBuffer.length + encryptedData.length);

  const res = await fetch(uploadURL, {
    method: 'POST',
    headers: {
      'content-length': contentLength.toString(),
      'content-type': `multipart/form-data; boundary=${boundaryString}`,
    },
    body,
  });
  if (!res.ok) {
    throw new Error('Failed to upload attachment');
  }
}
