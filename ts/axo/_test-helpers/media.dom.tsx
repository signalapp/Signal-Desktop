// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { commands } from 'vitest/browser';
import type { EmulateMediaOptions } from '../_test-setup/setup-commands.std.mts';

let isEmulatingMedia = false;

/**
 * Emulates CSS media features like `prefers-reduced-motion` or
 * `forced-colors` for the current test. Reset automatically after each test.
 *
 * @example
 * ```tsx
 * await emulateMedia({ forcedColors: 'active' });
 * ```
 */
export async function emulateMedia(
  options: EmulateMediaOptions
): Promise<void> {
  isEmulatingMedia = true;
  await commands.emulateMedia(options);
}

/** Resets any emulated media features back to the browser defaults. */
export async function resetEmulatedMedia(): Promise<void> {
  if (!isEmulatingMedia) {
    return;
  }
  isEmulatingMedia = false;
  await commands.emulateMedia({ forcedColors: null, reducedMotion: null });
}
