// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memoize, sortBy } from 'lodash';
import os from 'os';
import { ipcRenderer as ipc } from 'electron';
import { z } from 'zod';
import FormData from 'form-data';
import { gzip } from 'zlib';
import pify from 'pify';
import type { Response } from 'got';
import got from 'got';
import { getUserAgent } from '../util/getUserAgent';
import { maybeParseUrl } from '../util/url';
import * as log from './log';
import { reallyJsonStringify } from '../util/reallyJsonStringify';
import type { FetchLogIpcData, LogEntryType } from './shared';
import {
  LogLevel,
  getLogLevelString,
  isFetchLogIpcData,
  isLogEntry,
  levelMaxLength,
} from './shared';
import { redactAll } from '../util/privacy';
import { getEnvironment } from '../environment';

const BASE_URL = 'https://debuglogs.org';

const tokenBodySchema = z
  .object({
    fields: z.record(z.unknown()),
    url: z.string(),
  })
  .nonstrict();

const parseTokenBody = (
  rawBody: unknown
): { fields: Record<string, unknown>; url: string } => {
  const body = tokenBodySchema.parse(rawBody);

  const parsedUrl = maybeParseUrl(body.url);
  if (!parsedUrl) {
    throw new Error("Token body's URL was not a valid URL");
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new Error("Token body's URL was not HTTPS");
  }

  return body;
};

export const upload = async (
  content: string,
  appVersion: string
): Promise<string> => {
  const headers = { 'User-Agent': getUserAgent(appVersion) };

  const signedForm = await got.get(BASE_URL, { responseType: 'json', headers });
  const { fields, url } = parseTokenBody(signedForm.body);

  const uploadKey = `${fields.key}.gz`;

  const form = new FormData();
  // The API expects `key` to be the first field:
  form.append('key', uploadKey);
  Object.entries(fields)
    .filter(([key]) => key !== 'key')
    .forEach(([key, value]) => {
      form.append(key, value);
    });

  const contentBuffer = await pify(gzip)(Buffer.from(content, 'utf8'));
  const contentType = 'application/gzip';
  form.append('Content-Type', contentType);
  form.append('file', contentBuffer, {
    contentType,
    filename: `signal-desktop-debug-log-${appVersion}.txt.gz`,
  });

  log.info('Debug log upload starting...');
  try {
    const { statusCode, body } = await got.post(url, { headers, body: form });
    if (statusCode !== 204) {
      throw new Error(
        `Failed to upload to S3, got status ${statusCode}, body '${body}'`
      );
    }
  } catch (error) {
    const response = error.response as Response<string>;
    throw new Error(
      `Got threw on upload to S3, got status ${response?.statusCode}, body '${response?.body}'  `
    );
  }
  log.info('Debug log upload complete.');

  return `${BASE_URL}/${uploadKey}`;
};

// The mechanics of preparing a log for publish

const headerSectionTitle = (title: string) => `========= ${title} =========`;

const headerSection = (
  title: string,
  data: Readonly<Record<string, unknown>>
): string => {
  const sortedEntries = sortBy(Object.entries(data), ([key]) => key);
  return [
    headerSectionTitle(title),
    ...sortedEntries.map(
      ([key, value]) => `${key}: ${redactAll(String(value))}`
    ),
    '',
  ].join('\n');
};

const getHeader = (
  {
    capabilities,
    remoteConfig,
    statistics,
    user,
  }: Omit<FetchLogIpcData, 'logEntries'>,
  nodeVersion: string,
  appVersion: string
): string =>
  [
    headerSection('System info', {
      Time: Date.now(),
      'User agent': window.navigator.userAgent,
      'Node version': nodeVersion,
      Environment: getEnvironment(),
      'App version': appVersion,
      'OS version': os.version(),
    }),
    headerSection('User info', user),
    headerSection('Capabilities', capabilities),
    headerSection('Remote config', remoteConfig),
    headerSection('Statistics', statistics),
    headerSectionTitle('Logs'),
  ].join('\n');

const getLevel = memoize((level: LogLevel): string => {
  const text = getLogLevelString(level);
  return text.toUpperCase().padEnd(levelMaxLength, ' ');
});

function formatLine(mightBeEntry: unknown): string {
  const entry: LogEntryType = isLogEntry(mightBeEntry)
    ? mightBeEntry
    : {
        level: LogLevel.Error,
        msg: `Invalid IPC data when fetching logs. Here's what we could recover: ${reallyJsonStringify(
          mightBeEntry
        )}`,
        time: new Date().toISOString(),
      };

  return `${getLevel(entry.level)} ${entry.time} ${entry.msg}`;
}

export function fetch(
  nodeVersion: string,
  appVersion: string
): Promise<string> {
  return new Promise(resolve => {
    ipc.send('fetch-log');

    ipc.on('fetched-log', (_event, data: unknown) => {
      let header: string;
      let body: string;
      if (isFetchLogIpcData(data)) {
        const { logEntries } = data;
        header = getHeader(data, nodeVersion, appVersion);
        body = logEntries.map(formatLine).join('\n');
      } else {
        header = headerSectionTitle('Partial logs');
        const entry: LogEntryType = {
          level: LogLevel.Error,
          msg: 'Invalid IPC data when fetching logs; dropping all logs',
          time: new Date().toISOString(),
        };
        body = formatLine(entry);
      }

      const result = `${header}\n${body}`;
      resolve(result);
    });
  });
}
