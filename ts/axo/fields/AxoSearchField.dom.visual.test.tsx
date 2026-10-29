// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { AxoSearchField } from './AxoSearchField.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { emulateMedia } from '../_test-helpers/media.dom.tsx';
import { testStoryScreenshots } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoSearchField.dom.stories.tsx';

function DisabledSearchField(): ReactNode {
  return (
    <div className={tw('w-80 p-4')}>
      <AxoSearchField.Root
        value="Jamie"
        onValueChange={vi.fn<() => void>()}
        disabled
      >
        <AxoSearchField.Icon />
        <AxoSearchField.Input placeholder="Search" />
        <AxoSearchField.Clear />
      </AxoSearchField.Root>
    </div>
  );
}

describe('AxoSearchField', () => {
  testStoryScreenshots(stories);

  test('disabled', async () => {
    const screen = await renderAxo(<DisabledSearchField />);
    await expect(screen.container).toMatchScreenshot('disabled');
  });

  test('disabled in forced colors mode', async () => {
    await emulateMedia({ forcedColors: 'active' });
    const screen = await renderAxo(<DisabledSearchField />);
    await expect(screen.container).toMatchScreenshot('disabled-forced-colors');
  });
});
