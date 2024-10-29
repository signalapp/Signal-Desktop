// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memoize, sortBy } from 'lodash';
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
  appVersion: string,
  osVersion: string,
  userAgent: string,
  arch: string,
  runningUnderARM64Translation: boolean,
  linuxVersion?: string
): string =>
  [
    headerSection('System info', {
      Time: Date.now(),
      'User agent': userAgent,
      'Node version': nodeVersion,
      Environment: getEnvironment(),
      'App version': appVersion,
      'OS version': osVersion,
      Arch: `${arch}${runningUnderARM64Translation ? ' (ARM64 Translation)' : ''}`,
      ...(linuxVersion && { 'Linux version': linuxVersion }),
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

export function getLog(
  data: unknown,
  nodeVersion: string,
  appVersion: string,
  osVersion: string,
  userAgent: string,
  arch: string,
  runningUnderARM64Translation: boolean,
  linuxVersion?: string
): string {
  let header: string;
  let body: string;
  if (isFetchLogIpcData(data)) {
    const { logEntries } = data;
    header = getHeader(
      data,
      nodeVersion,
      appVersion,
      osVersion,
      userAgent,
      arch,
      runningUnderARM64Translation,
      linuxVersion
    );
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

  return `${header}\n${body}`;
}
