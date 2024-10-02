// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Response } from 'got';
import { z } from 'zod';
import FormData from 'form-data';
import got from 'got';
import { gzip } from 'zlib';
import pify from 'pify';
import { getUserAgent } from '../util/getUserAgent';
import { maybeParseUrl } from '../util/url';
import * as durations from '../util/durations';
import type { LoggerType } from '../types/Logging';
import { parseUnknown } from '../util/schemas';

const BASE_URL = 'https://debuglogs.org';

const UPLOAD_TIMEOUT = { request: durations.MINUTE };

const tokenBodySchema = z
  .object({
    fields: z.record(z.unknown()),
    url: z.string(),
  })
  .nonstrict();

const parseTokenBody = (
  rawBody: unknown
): { fields: Record<string, unknown>; url: string } => {
  const body = parseUnknown(tokenBodySchema, rawBody);

  const parsedUrl = maybeParseUrl(body.url);
  if (!parsedUrl) {
    throw new Error("Token body's URL was not a valid URL");
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new Error("Token body's URL was not HTTPS");
  }

  return body;
};

export type UploadOptionsType = Readonly<{
  content: string | Buffer | Uint8Array;
  appVersion: string;
  logger: LoggerType;
  extension?: string;
  contentType?: string;
  compress?: boolean;
  prefix?: string;
}>;

export const upload = async ({
  content,
  appVersion,
  logger,
  extension = 'gz',
  contentType = 'application/gzip',
  compress = true,
  prefix,
}: UploadOptionsType): Promise<string> => {
  const headers = { 'User-Agent': getUserAgent(appVersion) };

  const formUrl = new URL(BASE_URL);

  if (prefix !== undefined) {
    formUrl.searchParams.set('prefix', prefix);
  }

  const signedForm = await got.get(formUrl.toString(), {
    responseType: 'json',
    headers,
    timeout: UPLOAD_TIMEOUT,
  });
  const { fields, url } = parseTokenBody(signedForm.body);

  const uploadKey = `${fields.key}.${extension}`;

  const form = new FormData();
  // The API expects `key` to be the first field:
  form.append('key', uploadKey);
  Object.entries(fields)
    .filter(([key]) => key !== 'key')
    .forEach(([key, value]) => {
      form.append(key, value);
    });

  const contentBuffer = compress
    ? await pify(gzip)(Buffer.from(content))
    : Buffer.from(content);
  form.append('Content-Type', contentType);
  form.append('file', contentBuffer, {
    contentType,
    filename: `signal-desktop-debug-log-${appVersion}.txt.gz`,
  });

  logger.info('Debug log upload starting...');
  try {
    const { statusCode, body } = await got.post(url, {
      headers,
      body: form,
      timeout: UPLOAD_TIMEOUT,
    });
    if (statusCode !== 204) {
      throw new Error(
        `Failed to upload to S3, got status ${statusCode}, body '${body}'`
      );
    }
  } catch (error) {
    const response = error.response as Response<string>;
    throw new Error(
      `Got threw on upload to S3: "${error.message}", got status ${response?.statusCode}, body '${response?.body}'  `
    );
  }
  logger.info('Debug log upload complete.');

  return `${BASE_URL}/${uploadKey}`;
};
