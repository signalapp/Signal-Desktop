// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

export const COLOR_WHITE_INT = 0xFFFFFF;

export function getHexFromNumber(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function getBackgroundColor(gradient?: unknown): string {
  return '#FFFFFF';
}

export function getStoryBackground(): undefined {
  return undefined;
}
