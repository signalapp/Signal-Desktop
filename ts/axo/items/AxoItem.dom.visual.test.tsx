// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AxoItem } from './AxoItem.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { emulateMedia } from '../_test-helpers/media.dom.tsx';
import { testStoryScreenshots } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoItem.dom.stories.tsx';

function TestItems(): ReactNode {
  return (
    <div className={tw('w-100 p-4')}>
      <AxoItem.Group>
        <AxoItem.Root>
          <AxoItem.Leading>
            <AxoItem.Icon symbol="settings" />
          </AxoItem.Leading>
          <AxoItem.Content>
            <AxoItem.Label>Notifications</AxoItem.Label>
            <AxoItem.Description>Sounds and badges</AxoItem.Description>
            <AxoItem.HiddenTrigger
              label="Notifications"
              onClick={vi.fn<() => void>()}
            />
            <AxoItem.Trailing>
              <AxoItem.Arrow />
            </AxoItem.Trailing>
          </AxoItem.Content>
        </AxoItem.Root>
        <AxoItem.Root>
          <AxoItem.Leading>
            <AxoItem.Icon symbol="appearance" />
          </AxoItem.Leading>
          <AxoItem.Content>
            <AxoItem.Label>Appearance</AxoItem.Label>
            <AxoItem.HiddenTrigger
              label="Appearance"
              onClick={vi.fn<() => void>()}
            />
            <AxoItem.Trailing>
              <AxoItem.Arrow />
            </AxoItem.Trailing>
          </AxoItem.Content>
        </AxoItem.Root>
      </AxoItem.Group>
    </div>
  );
}

describe('AxoItem', () => {
  testStoryScreenshots(stories);

  test('focus ring is visible', async () => {
    const screen = await renderAxo(<TestItems />);
    await userEvent.tab();
    await expect(screen.container).toMatchScreenshot('focus-ring');
  });

  test('focus ring is visible in forced colors mode', async () => {
    await emulateMedia({ forcedColors: 'active' });
    const screen = await renderAxo(<TestItems />);
    await userEvent.tab();
    await expect(screen.container).toMatchScreenshot(
      'focus-ring-forced-colors'
    );
  });

  test('hovered item is highlighted', async () => {
    const screen = await renderAxo(<TestItems />);
    await screen.getByRole('listitem', { name: 'Appearance' }).hover();
    await expect(screen.container).toMatchScreenshot('hovered');
  });
});
