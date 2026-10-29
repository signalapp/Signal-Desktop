// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, beforeAll, beforeEach } from 'vitest';
// Importing `vitest-browser-react` also registers automatic cleanup
import 'vitest-browser-react';
import { configure } from 'vitest-browser-react/pure';
import { Environment, setEnvironment } from '../../environment.std.ts';
import { applyDocumentEnvironment } from '../_test-helpers/render.dom.tsx';
import { resetEmulatedMedia } from '../_test-helpers/media.dom.tsx';

// Some components disable animations in test environments
setEnvironment(Environment.Test, false);

configure({ reactStrictMode: true });

/**
 * Fonts are only downloaded once text uses them, so screenshots could be taken
 * with fallback fonts. Load every font that components use upfront instead.
 */
const PRELOADED_FONTS = [
  '400 1em Inter',
  '500 1em Inter',
  '600 1em Inter',
  'italic 400 1em Inter',
  'italic 600 1em Inter',
  '1em SignalSymbols',
  '1em MonoSpecial',
  '1em "Signal Emoji Small"',
  // Downloaded from updates.signal.org
  '1em "Signal Emoji Large"',
];

async function preloadFont(font: string): Promise<void> {
  // Rejects if the font fails to download
  const fontFaces = await document.fonts.load(font);
  if (fontFaces.length === 0) {
    throw new Error(`No @font-face matches "${font}"`);
  }
}

beforeAll(async () => {
  await Promise.all(PRELOADED_FONTS.map(preloadFont));
});

/**
 * Pressing Tab starts from wherever focus was last, even after the previous
 * test was cleaned up. Move the starting point back to the top of the page.
 */
function resetFocusNavigationStartingPoint(): void {
  const element = document.createElement('div');
  element.tabIndex = -1;
  document.body.prepend(element);
  element.focus();
  element.remove();
}

beforeEach(() => {
  applyDocumentEnvironment('light', 'ltr');
  resetFocusNavigationStartingPoint();
});

afterEach(async () => {
  await resetEmulatedMedia();
});
