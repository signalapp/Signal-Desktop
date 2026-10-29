// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { AxoProgressIndicator } from './AxoProgressIndicator.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoProgressIndicator.dom.stories.tsx';

describe('AxoProgressIndicator', () => {
  testStoriesWithAxe(stories);

  test('exposes the progress value', async () => {
    await renderAxo(
      <AxoProgressIndicator.Root size="md" completed={30} total={120} />
    );

    const progressbar = page.getByRole('progressbar');
    await expect.element(progressbar).toHaveAttribute('aria-valuenow', '30');
    await expect.element(progressbar).toHaveAttribute('aria-valuemax', '120');
  });

  describe('is indeterminate', () => {
    async function check(
      completed: number | 'indeterminate',
      total: number | 'indeterminate'
    ) {
      await renderAxo(
        <AxoProgressIndicator.Root
          size="md"
          completed={completed}
          total={total}
        />
      );

      await expect
        .element(page.getByRole('progressbar'))
        .not.toHaveAttribute('aria-valuenow');
    }

    test('when completed is indeterminate', () => check('indeterminate', 100));

    test('when total is indeterminate', () => check(30, 'indeterminate'));
  });
});
