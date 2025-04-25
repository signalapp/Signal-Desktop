// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export function isAnyOverlayOpen(): boolean {
  return document.querySelector('.conversation .panel') !== null;
} 