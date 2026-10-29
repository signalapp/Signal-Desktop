// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { tw } from './tw.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { emulateMedia } from './_test-helpers/media.dom.tsx';
import { testStoryScreenshots } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoTabs.dom.stories.tsx';

describe('AxoTabs', () => {
  testStoryScreenshots(stories);

  describe('focused tab', () => {
    async function check(mode: 'light' | 'dark' | 'forced-colors') {
      await emulateMedia({
        forcedColors: mode === 'forced-colors' ? 'active' : 'none',
      });
      const screen = await renderAxo(
        <div data-testid="frame" className={tw('w-[360px] p-4')}>
          <stories.Basic />
        </div>,
        { theme: mode === 'dark' ? 'dark' : 'light' }
      );

      await userEvent.tab();
      await expect(screen.getByTestId('frame')).toMatchScreenshot(
        `focused-tab-${mode}`
      );
    }

    test('light', () => check('light'));

    test('dark', () => check('dark'));

    test('forced-colors', () => check('forced-colors'));
  });
});
