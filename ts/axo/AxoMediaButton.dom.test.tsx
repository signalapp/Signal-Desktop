// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AxoMediaButton } from './AxoMediaButton.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoMediaButton.dom.stories.tsx';

const button = page.getByRole('button');

describe('AxoMediaButton', () => {
  testStoriesWithAxe(stories);

  test('disabled buttons stay focusable but do not call onClick', async () => {
    const onClick = vi.fn<() => void>();
    await renderAxo(
      <AxoMediaButton.Root
        status="paused"
        downloadedBytes={1000}
        totalBytes={1000}
        disabled
        onClick={onClick}
      />
    );

    await userEvent.tab();
    await expect.element(button).toHaveFocus();
    await expect.element(button).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    await button.click({ force: true });
    expect(onClick).not.toHaveBeenCalled();
  });

  test('shows download progress', async () => {
    await renderAxo(
      <AxoMediaButton.Root
        status="downloading"
        downloadedBytes={300}
        totalBytes={1000}
        onClick={vi.fn<() => void>()}
      />
    );

    const progressbar = page.getByRole('progressbar');
    await expect.element(progressbar).toHaveAttribute('aria-valuenow', '300');
    await expect.element(progressbar).toHaveAttribute('aria-valuemax', '1000');
  });
});
