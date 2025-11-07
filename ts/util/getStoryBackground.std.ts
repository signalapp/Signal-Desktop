// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// REMOVED: Orbital cleanup - Stories feature removed
// This file exists as a stub to prevent import errors during the transition

export const COLOR_WHITE_INT = 0xffffffff;

export function getHexFromNumber(color: number): string {
  return `#${color.toString(16).padStart(8, '0')}`;
}

export function getBackgroundColor(gradient?: any): string {
  return getHexFromNumber(COLOR_WHITE_INT);
}

export function getStoryBackground(..._args: Array<any>): any {
  // Stub - Stories feature removed
  return undefined;
}
