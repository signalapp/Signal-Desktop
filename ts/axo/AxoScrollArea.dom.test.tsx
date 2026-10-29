// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { AxoScrollArea } from './AxoScrollArea.dom.tsx';
import { tw } from './tw.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoScrollArea.dom.stories.tsx';

describe('AxoScrollArea', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: Scrollable viewports need a `tabindex`, and a role and name to
      // announce when focused (Chromium focuses them anyway, see below).
      Vertical: ['scrollable-region-focusable'],
      VerticalWithHints: ['scrollable-region-focusable'],
      VerticalWithMask: ['scrollable-region-focusable'],
      Horizontal: ['scrollable-region-focusable'],
      HorizontalWithHints: ['scrollable-region-focusable'],
      HorizontalWithMask: ['scrollable-region-focusable'],
      Both: ['scrollable-region-focusable'],
      BothWithHints: ['scrollable-region-focusable'],
      BothWithMask: ['scrollable-region-focusable'],
    },
  });

  test('scrollable viewport without focusable content can be focused and scrolled', async () => {
    await renderAxo(
      <div className={tw('size-50')}>
        <AxoScrollArea.Root scrollbarWidth="thin">
          <AxoScrollArea.Viewport>
            <AxoScrollArea.Content>
              {Array.from({ length: 10 }, (_, index) => {
                return (
                  <p key={index} className={tw('p-10')}>
                    Item {index + 1}
                  </p>
                );
              })}
            </AxoScrollArea.Content>
          </AxoScrollArea.Viewport>
        </AxoScrollArea.Root>
      </div>
    );

    const viewport = document.querySelector('[data-axo-scroll-area-viewport]');
    await userEvent.tab();
    expect(document.activeElement).toBe(viewport);
    await userEvent.keyboard('{ArrowDown}');
    await expect.poll(() => viewport?.scrollTop).toBeGreaterThan(0);
  });
});
