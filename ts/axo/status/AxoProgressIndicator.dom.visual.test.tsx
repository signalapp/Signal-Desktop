// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { AxoProgressIndicator } from './AxoProgressIndicator.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { emulateMedia } from '../_test-helpers/media.dom.tsx';
import { testStoryScreenshots } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoProgressIndicator.dom.stories.tsx';

describe('AxoProgressIndicator', () => {
  testStoryScreenshots(stories, {
    // Covered by the fixed progress tests below
    skip: {
      Basic: 'Renders random progress',
      NoTrack: 'Renders random progress',
      Sizes: 'Renders random progress',
      Weights: 'Renders random progress',
    },
  });

  describe('fixed progress', () => {
    async function check(mode: 'light' | 'forced-colors') {
      await emulateMedia({
        forcedColors: mode === 'forced-colors' ? 'active' : 'none',
      });
      const screen = await renderAxo(
        <div className={tw('flex flex-col gap-2 p-2')}>
          {[0, 25, 50, 75, 100].map(completed => {
            return (
              <div key={completed} className={tw('flex gap-2')}>
                <AxoProgressIndicator.Root
                  size="sm"
                  completed={completed}
                  total={100}
                />
                <AxoProgressIndicator.Root
                  size="md"
                  completed={completed}
                  total={100}
                />
                <AxoProgressIndicator.Root
                  size="lg"
                  completed={completed}
                  total={100}
                />
                <AxoProgressIndicator.Root
                  size="md"
                  weight="thin"
                  completed={completed}
                  total={100}
                />
                <AxoProgressIndicator.Root
                  size="md"
                  weight="medium"
                  completed={completed}
                  total={100}
                />
                <AxoProgressIndicator.Root
                  size="md"
                  noTrack
                  completed={completed}
                  total={100}
                />
              </div>
            );
          })}
        </div>
      );

      await expect(screen.container).toMatchScreenshot(
        `fixed-progress-${mode}`,
        { screenshotOptions: { animations: 'disabled' } }
      );
    }

    test('light', () => check('light'));

    test('forced-colors', () => check('forced-colors'));
  });
});
