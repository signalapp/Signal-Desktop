// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { ExperimentalAxoSegmentedControl } from './AxoSegmentedControl.dom.tsx';
import { tw } from './tw.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { emulateMedia } from './_test-helpers/media.dom.tsx';
import { testStoryScreenshots } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoSegmentedControl.dom.stories.tsx';

describe('AxoSegmentedControl', () => {
  testStoryScreenshots(stories);

  describe('focused item', () => {
    async function check(mode: 'light' | 'dark' | 'forced-colors') {
      await emulateMedia({
        forcedColors: mode === 'forced-colors' ? 'active' : 'none',
      });
      const screen = await renderAxo(
        <div data-testid="frame" className={tw('w-fit p-4')}>
          <ExperimentalAxoSegmentedControl.Root
            label="Folders"
            variant="track"
            width="fit"
            itemWidth="fit"
            value="drafts"
            onValueChange={() => null}
          >
            <ExperimentalAxoSegmentedControl.Item value="inbox">
              <ExperimentalAxoSegmentedControl.ItemText>
                Inbox
              </ExperimentalAxoSegmentedControl.ItemText>
            </ExperimentalAxoSegmentedControl.Item>
            <ExperimentalAxoSegmentedControl.Item value="drafts">
              <ExperimentalAxoSegmentedControl.ItemText>
                Drafts
              </ExperimentalAxoSegmentedControl.ItemText>
            </ExperimentalAxoSegmentedControl.Item>
            <ExperimentalAxoSegmentedControl.Item value="sent">
              <ExperimentalAxoSegmentedControl.ItemText>
                Sent
              </ExperimentalAxoSegmentedControl.ItemText>
            </ExperimentalAxoSegmentedControl.Item>
          </ExperimentalAxoSegmentedControl.Root>
        </div>,
        { theme: mode === 'dark' ? 'dark' : 'light' }
      );

      await userEvent.tab();
      await userEvent.keyboard('{ArrowRight}');
      await expect(screen.getByTestId('frame')).toMatchScreenshot(
        `track-focused-unselected-${mode}`
      );
    }

    test('light', () => check('light'));

    test('dark', () => check('dark'));

    test('forced-colors', () => check('forced-colors'));
  });
});
