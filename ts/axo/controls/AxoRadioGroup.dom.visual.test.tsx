// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { AxoRadioGroup } from './AxoRadioGroup.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { emulateMedia } from '../_test-helpers/media.dom.tsx';
import { testStoryScreenshots } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoRadioGroup.dom.stories.tsx';

function DisabledRadioGroup(): ReactNode {
  return (
    <div className={tw('p-4')}>
      <AxoRadioGroup.Root
        label="Disabled"
        value="on"
        onValueChange={vi.fn<() => void>()}
      >
        <AxoRadioGroup.Item value="on">
          <AxoRadioGroup.Label>Enabled, checked</AxoRadioGroup.Label>
        </AxoRadioGroup.Item>
        <AxoRadioGroup.Item value="off">
          <AxoRadioGroup.Label>Enabled, unchecked</AxoRadioGroup.Label>
        </AxoRadioGroup.Item>
      </AxoRadioGroup.Root>
      <AxoRadioGroup.Root
        label="Disabled"
        value="on"
        onValueChange={vi.fn<() => void>()}
        disabled
      >
        <AxoRadioGroup.Item value="on">
          <AxoRadioGroup.Label>Disabled, checked</AxoRadioGroup.Label>
        </AxoRadioGroup.Item>
        <AxoRadioGroup.Item value="off">
          <AxoRadioGroup.Label>Disabled, unchecked</AxoRadioGroup.Label>
        </AxoRadioGroup.Item>
      </AxoRadioGroup.Root>
    </div>
  );
}

describe('AxoRadioGroup', () => {
  testStoryScreenshots(stories);

  test('disabled states', async () => {
    const screen = await renderAxo(<DisabledRadioGroup />);
    await expect(screen.container).toMatchScreenshot('disabled');
  });

  test('disabled states in forced colors mode', async () => {
    await emulateMedia({ forcedColors: 'active' });
    const screen = await renderAxo(<DisabledRadioGroup />);
    await expect(screen.container).toMatchScreenshot('disabled-forced-colors');
  });
});
