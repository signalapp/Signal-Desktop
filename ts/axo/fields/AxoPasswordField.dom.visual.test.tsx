// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { AxoPasswordField } from './AxoPasswordField.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoryScreenshots } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoPasswordField.dom.stories.tsx';

describe('AxoPasswordField', () => {
  testStoryScreenshots(stories);

  test('revealed password', async () => {
    const screen = await renderAxo(
      <div className={tw('w-80 p-4')}>
        <AxoPasswordField.Root
          value="hunter2"
          onValueChange={vi.fn<() => void>()}
          maxGraphemes={64}
          maxBytes={256}
        >
          <AxoPasswordField.Input
            placeholder="Password"
            autoComplete="current-password"
          />
          <AxoPasswordField.Reveal />
        </AxoPasswordField.Root>
      </div>
    );
    await screen.getByRole('button', { name: 'Show Password' }).click();
    await expect(screen.container).toMatchScreenshot('revealed');
  });
});
