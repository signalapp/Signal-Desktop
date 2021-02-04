// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop } from 'lodash';
import { LogLevel } from './shared';

type LogAtLevelFnType = (
  level: LogLevel,
  ...args: ReadonlyArray<unknown>
) => void;

let logAtLevel: LogAtLevelFnType = noop;
let hasInitialized = false;

type LogFn = (...args: ReadonlyArray<unknown>) => void;
export const fatal: LogFn = (...args) => logAtLevel(LogLevel.Fatal, ...args);
export const error: LogFn = (...args) => logAtLevel(LogLevel.Error, ...args);
export const warn: LogFn = (...args) => logAtLevel(LogLevel.Warn, ...args);
export const info: LogFn = (...args) => logAtLevel(LogLevel.Info, ...args);
export const debug: LogFn = (...args) => logAtLevel(LogLevel.Debug, ...args);
export const trace: LogFn = (...args) => logAtLevel(LogLevel.Trace, ...args);

/**
 * Sets the low-level logging interface. Should be called early in a process's life, and
 * can only be called once.
 */
export function setLogAtLevel(log: LogAtLevelFnType): void {
  if (hasInitialized) {
    throw new Error('Logger has already been initialized');
  }
  logAtLevel = log;
  hasInitialized = true;
}
