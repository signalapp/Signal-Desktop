// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AxoStackedButton } from './AxoStackedButton.dom.tsx';
import { tw } from './tw.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoryScreenshots } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoStackedButton.dom.stories.tsx';

describe('AxoStackedButton', () => {
  testStoryScreenshots(stories);

  test('focus ring is visible', async () => {
    const screen = await renderAxo(
      <div className={tw('p-4')}>
        <AxoStackedButton.Root symbol="camera" label="Video" />
      </div>
    );
    await userEvent.tab();
    await expect(screen.container).toMatchScreenshot('focus-ring');
  });
});
