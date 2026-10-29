// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AxoTextField } from './AxoTextField.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoryScreenshots } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoTextField.dom.stories.tsx';

function FocusedTextField(): ReactNode {
  return (
    <div className={tw('w-80 p-4')}>
      <AxoTextField.Root
        value="Typed text"
        onValueChange={vi.fn<() => void>()}
        maxGraphemes={200}
        maxBytes={800}
      >
        <AxoTextField.Icon symbol="label" />
        <AxoTextField.Input placeholder="Placeholder" />
        <AxoTextField.Clear />
      </AxoTextField.Root>
    </div>
  );
}

describe('AxoTextField', () => {
  testStoryScreenshots(stories);

  test('focus ring is visible', async () => {
    const screen = await renderAxo(<FocusedTextField />);
    await userEvent.tab();
    await expect(screen.container).toMatchScreenshot('focus-ring');
  });

  test('clear button focus ring is visible', async () => {
    const screen = await renderAxo(<FocusedTextField />);
    await userEvent.tab();
    await userEvent.tab();
    await expect(screen.container).toMatchScreenshot('clear-focus-ring');
  });
});
