// Copyright 2018-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memoize, sortBy } from 'lodash';
import os from 'os';
import { ipcRenderer as ipc } from 'electron';
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
    appMetrics,
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
    headerSection(
      'Metrics',
      appMetrics.reduce((acc, stats, index) => {
        const {
          type = '?',
          serviceName = '?',
          name = '?',
          cpu,
          memory,
        } = stats;

        const processId = `${index}:${type}/${serviceName}/${name}`;

        return {
          ...acc,
          [processId]:
            `cpuUsage=${cpu.percentCPUUsage.toFixed(2)} ` +
            `wakeups=${cpu.idleWakeupsPerSecond} ` +
            `workingMemory=${memory.workingSetSize} ` +
            `peakWorkingMemory=${memory.peakWorkingSetSize}`,
        };
      }, {})
    ),
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

export async function fetch(
  nodeVersion: string,
  appVersion: string
): Promise<string> {
  const data: unknown = await ipc.invoke('fetch-log');

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

  return `${header}\n${body}`;
}
