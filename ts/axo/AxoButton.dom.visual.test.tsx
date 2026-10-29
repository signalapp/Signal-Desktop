// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AxoButton } from './AxoButton.dom.tsx';
import { tw } from './tw.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { emulateMedia } from './_test-helpers/media.dom.tsx';
import { testStoryScreenshots } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoButton.dom.stories.tsx';

describe('AxoButton', () => {
  testStoryScreenshots(stories);

  test('focus ring is visible', async () => {
    const screen = await renderAxo(
      <div className={tw('p-4')}>
        <AxoButton.Root variant="strong-primary" size="md">
          Focused
        </AxoButton.Root>
      </div>
    );

    await userEvent.tab();
    await expect(screen.container).toMatchScreenshot('focus-ring');
  });

  test('focus ring is visible in forced colors mode', async () => {
    await emulateMedia({ forcedColors: 'active' });
    const screen = await renderAxo(
      <div className={tw('p-4')}>
        <AxoButton.Root variant="strong-primary" size="md">
          Focused
        </AxoButton.Root>
      </div>
    );

    await userEvent.tab();
    await expect(screen.container).toMatchScreenshot(
      'focus-ring-forced-colors'
    );
  });
});
