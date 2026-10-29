// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { AxoChatEvent } from './AxoChatEvent.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoChatEvent.dom.stories.tsx';

describe('AxoChatEvent', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: `discouraged` actions and the `destructive` variant don't have
      // enough contrast
      Variants: ['color-contrast'],
    },
  });

  test("inline actions don't propagate clicks", async () => {
    const onClick = vi.fn<() => void>();
    const onParentClick = vi.fn<() => void>();
    await renderAxo(
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={onParentClick}>
        <AxoChatEvent.InlineAction onClick={onClick}>
          John
        </AxoChatEvent.InlineAction>
      </div>
    );

    await page.getByRole('button', { name: 'John' }).click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
