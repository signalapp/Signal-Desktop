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

beforeAll(async () => {
  await document.fonts.ready;
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
