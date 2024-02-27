// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

let shouldQuitFlag = false;

export function markShouldQuit(): void {
  shouldQuitFlag = true;
}

export function markShouldNotQuit(): void {
  shouldQuitFlag = false;
}

export function shouldQuit(): boolean {
  return shouldQuitFlag;
}

let isReadyForShutdown = false;

export function markReadyForShutdown(): void {
  isReadyForShutdown = true;
}

export function readyForShutdown(): boolean {
  return isReadyForShutdown;
}

let hasRequestedShutdown = false;

export function markRequestedShutdown(): void {
  hasRequestedShutdown = true;
}

export function requestedShutdown(): boolean {
  return hasRequestedShutdown;
}
