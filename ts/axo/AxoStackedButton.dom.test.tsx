// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AxoStackedButton } from './AxoStackedButton.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { getTabSequence } from './_test-helpers/a11y.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoStackedButton.dom.stories.tsx';

describe('AxoStackedButton', () => {
  testStoriesWithAxe(stories);

  test('disabled buttons stay focusable but do not call onClick', async () => {
    const onClick = vi.fn<() => void>();
    await renderAxo(
      <AxoStackedButton.Root
        symbol="camera"
        label="Video"
        disabled
        onClick={onClick}
      />
    );

    await expect(getTabSequence()).resolves.toStrictEqual(['button "Video"']);
    const button = page.getByRole('button', { name: 'Video' });
    await expect.element(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    await button.click({ force: true });
    expect(onClick).not.toHaveBeenCalled();
  });

  test('pending buttons are described as "Pending" and do not call onClick', async () => {
    const onClick = vi.fn<() => void>();
    await renderAxo(
      <AxoStackedButton.Root
        symbol="minus-circle"
        label="Remove"
        pending
        onClick={onClick}
      />
    );

    const button = page.getByRole('button', { name: 'Remove' });
    await expect.element(button).toHaveAccessibleDescription('Pending');
    await expect.element(button).toHaveAttribute('aria-busy', 'true');
    await expect.element(button).toHaveAttribute('aria-disabled', 'true');
    await button.click({ force: true });
    expect(onClick).not.toHaveBeenCalled();
  });

  test('discouraged buttons can still be clicked', async () => {
    const onClick = vi.fn<() => void>();
    await renderAxo(
      <AxoStackedButton.Root
        symbol="phone"
        label="Audio"
        discouraged
        onClick={onClick}
      />
    );

    const button = page.getByRole('button', { name: 'Audio' });
    await expect.element(button).not.toHaveAttribute('aria-disabled');
    await button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
