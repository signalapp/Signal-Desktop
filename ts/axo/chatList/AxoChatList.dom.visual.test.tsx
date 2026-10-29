// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { emulateMedia } from '../_test-helpers/media.dom.tsx';
import { testStoryScreenshots } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoChatList.dom.stories.tsx';

describe('AxoChatList', () => {
  testStoryScreenshots(stories);

  describe('focused chat', () => {
    async function check(mode: 'light' | 'forced-colors') {
      await emulateMedia({
        forcedColors: mode === 'forced-colors' ? 'active' : 'none',
      });
      const screen = await renderAxo(<stories.Groups />);

      await userEvent.tab();
      await userEvent.tab();
      await expect(screen.container).toMatchScreenshot(`focused-chat-${mode}`);
    }

    test('light', () => check('light'));

    test('forced-colors', () => check('forced-colors'));
  });

  describe('hovered chat', () => {
    async function check(mode: 'light' | 'forced-colors') {
      await emulateMedia({
        forcedColors: mode === 'forced-colors' ? 'active' : 'none',
      });
      const screen = await renderAxo(<stories.Groups />);

      await page.getByRole('button').nth(1).hover();
      await expect(screen.container).toMatchScreenshot(`hovered-chat-${mode}`);
    }

    test('light', () => check('light'));

    test('forced-colors', () => check('forced-colors'));
  });
});
