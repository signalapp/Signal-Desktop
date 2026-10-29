// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AxoScrollArea } from './AxoScrollArea.dom.tsx';
import { tw } from './tw.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { emulateMedia } from './_test-helpers/media.dom.tsx';
import { testStoryScreenshots } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoScrollArea.dom.stories.tsx';

function FocusableScrollArea(): ReactNode {
  return (
    <div className={tw('p-4')}>
      <div className={tw('size-50')}>
        <AxoScrollArea.Root scrollbarWidth="thin">
          <AxoScrollArea.Hint edge="top" />
          <AxoScrollArea.Hint edge="bottom" />
          <AxoScrollArea.Viewport>
            <AxoScrollArea.Content>
              {Array.from({ length: 10 }, (_, index) => {
                return (
                  <p key={index} className={tw('p-4 type-body-large')}>
                    Item {index + 1}
                  </p>
                );
              })}
            </AxoScrollArea.Content>
          </AxoScrollArea.Viewport>
        </AxoScrollArea.Root>
      </div>
    </div>
  );
}

describe('AxoScrollArea', () => {
  testStoryScreenshots(stories);

  test('focus ring is visible', async () => {
    const screen = await renderAxo(<FocusableScrollArea />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    await expect(screen.container).toMatchScreenshot('focus-ring');
  });

  test('focus ring is visible in forced colors mode', async () => {
    await emulateMedia({ forcedColors: 'active' });
    const screen = await renderAxo(<FocusableScrollArea />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowDown}');
    await expect(screen.container).toMatchScreenshot(
      'focus-ring-forced-colors'
    );
  });
});
