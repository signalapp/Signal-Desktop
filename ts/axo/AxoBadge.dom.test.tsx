// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { AxoBadge } from './AxoBadge.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoBadge.dom.stories.tsx';

describe('AxoBadge', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: Primary badge count text doesn't have enough contrast in dark mode
      Digits: ['color-contrast'],
      Max: ['color-contrast'],
    },
  });

  test('formats counts and overflow with the locale', async () => {
    const screen = await renderAxo(
      <>
        <AxoBadge.Root
          variant="primary"
          size="md"
          value={100}
          max={99}
          label={null}
        />
        <AxoBadge.Root
          variant="primary"
          size="md"
          value={1234}
          max={Infinity}
          label={null}
        />
        <AxoBadge.Root
          variant="primary"
          size="md"
          value={10000}
          max={9999}
          label={null}
        />
      </>
    );

    await expect.element(screen.getByText('99+')).toBeVisible();
    await expect.element(screen.getByText('1,234')).toBeVisible();
    await expect.element(screen.getByText('9,999+')).toBeVisible();
  });
});
