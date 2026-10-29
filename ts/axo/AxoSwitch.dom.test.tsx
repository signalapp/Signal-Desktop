// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { AxoSwitch } from './AxoSwitch.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { getTabSequence } from './_test-helpers/a11y.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoSwitch.dom.stories.tsx';

describe('AxoSwitch', () => {
  testStoriesWithAxe(stories);

  test('disabled switches stay focusable', async () => {
    await renderAxo(
      <>
        <AxoSwitch.Root
          label="One"
          checked={false}
          onCheckedChange={vi.fn<() => void>()}
        />
        <AxoSwitch.Root
          label="Two"
          disabled
          checked={false}
          onCheckedChange={vi.fn<() => void>()}
        />
      </>
    );

    await expect(getTabSequence()).resolves.toStrictEqual([
      'switch "One"',
      'switch "Two"',
    ]);
    await expect
      .element(page.getByRole('switch', { name: 'Two' }))
      .toHaveAttribute('aria-disabled', 'true');
  });

  test('disabled switches cannot be toggled', async () => {
    const onCheckedChange = vi.fn<() => void>();
    const screen = await renderAxo(
      <>
        <AxoSwitch.Root
          id="disabled-switch"
          disabled
          checked={false}
          onCheckedChange={onCheckedChange}
        />
        <label htmlFor="disabled-switch">Disabled</label>
      </>
    );
    const toggle = screen.getByRole('switch', { name: 'Disabled' });
    await toggle.click({ force: true });
    await expect.element(toggle).not.toBeChecked();
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
