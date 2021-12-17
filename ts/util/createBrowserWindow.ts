// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This is the one place that *should* be able to import `BrowserWindow`.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { BrowserWindow } from 'electron';
import type { BrowserWindowConstructorOptions } from 'electron';

const SPELL_CHECKER_DICTIONARY_DOWNLOAD_URL = `https://updates.signal.org/desktop/hunspell_dictionaries/${process.versions.electron}/`;

/**
 * A wrapper around `new BrowserWindow` that updates the spell checker download URL. This
 * function should be used instead of `new BrowserWindow`.
 */
export function createBrowserWindow(
  options: BrowserWindowConstructorOptions
): BrowserWindow {
  const result = new BrowserWindow(options);

  result.webContents.session.setSpellCheckerDictionaryDownloadURL(
    SPELL_CHECKER_DICTIONARY_DOWNLOAD_URL
  );

  return result;
}
