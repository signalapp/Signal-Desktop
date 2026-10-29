// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { BrowserCommand } from 'vitest/node';

/**
 * Media features to emulate, `null` resets them back to the default.
 */
export type EmulateMediaOptions = Readonly<{
  forcedColors?: 'active' | 'none' | null;
  reducedMotion?: 'reduce' | 'no-preference' | null;
}>;

const emulateMedia: BrowserCommand<[options: EmulateMediaOptions]> = async (
  context,
  options
) => {
  await context.page.emulateMedia(options);
};

const resetPointer: BrowserCommand = async context => {
  // Outside of the page, so nothing is left hovered
  await context.page.mouse.move(-1, -1);
};

/**
 * Commands that run in Node.js with access to the Playwright page, called
 * from browser tests with `commands` from `vitest/browser`.
 */
export const axoBrowserCommands = {
  emulateMedia,
  resetPointer,
};

declare module 'vitest/browser' {
  // oxlint-disable-next-line typescript/consistent-type-definitions
  interface BrowserCommands {
    emulateMedia: (options: EmulateMediaOptions) => Promise<void>;
    resetPointer: () => Promise<void>;
  }
}
