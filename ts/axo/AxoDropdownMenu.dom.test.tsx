// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AxoDropdownMenu } from './AxoDropdownMenu.dom.tsx';
import { AxoButton } from './AxoButton.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { describeFocused } from './_test-helpers/a11y.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoDropdownMenu.dom.stories.tsx';

function TestMenu(props: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <AxoDropdownMenu.Root>
      <AxoDropdownMenu.Trigger>
        <AxoButton.Root variant="strong-secondary" size="md">
          Open Menu
        </AxoButton.Root>
      </AxoDropdownMenu.Trigger>
      <AxoDropdownMenu.Content>{props.children}</AxoDropdownMenu.Content>
    </AxoDropdownMenu.Root>
  );
}

// Menu content is portalled outside of the render container
const menu = page.getByRole('menu');

describe('AxoDropdownMenu', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // axe counts item descriptions as part of their visible label
      WithItemDescriptions: ['label-content-name-mismatch'],
    },
  });

  test('typeahead focuses checkbox items', async () => {
    await renderAxo(
      <TestMenu>
        <AxoDropdownMenu.Item onSelect={vi.fn<() => void>()}>
          Reload
        </AxoDropdownMenu.Item>
        <AxoDropdownMenu.CheckboxItem
          checked
          onCheckedChange={vi.fn<() => void>()}
        >
          Show Bookmarks
        </AxoDropdownMenu.CheckboxItem>
      </TestMenu>
    );

    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect.element(menu).toBeVisible();

    await userEvent.keyboard('S');
    await expect
      .poll(describeFocused)
      .toBe('menuitemcheckbox "Show Bookmarks"');
  });
});
