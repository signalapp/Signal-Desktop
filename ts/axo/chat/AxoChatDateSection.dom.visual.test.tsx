// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { emulateMedia } from '../_test-helpers/media.dom.tsx';
import { testStoryScreenshots } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoChatDateSection.dom.stories.tsx';

function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });
}

describe('AxoChatDateSection', () => {
  testStoryScreenshots(stories);

  describe('stuck header', () => {
    async function check(mode: 'light' | 'forced-colors') {
      await emulateMedia({
        forcedColors: mode === 'forced-colors' ? 'active' : 'none',
      });
      const screen = await renderAxo(<stories.Basic />);

      const viewport = screen.container.querySelector(
        '[data-axo-scroll-area-viewport]'
      );
      expect(viewport).not.toBeNull();
      // Scroll into the first section so its header is stuck
      viewport?.scrollTo({ top: 120 });
      await nextFrame();
      await nextFrame();

      await expect(screen.container).toMatchScreenshot(`stuck-header-${mode}`, {
        screenshotOptions: { animations: 'disabled' },
      });
    }

    test('light', () => check('light'));

    test('forced-colors', () => check('forced-colors'));
  });
});
