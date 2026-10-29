// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { ExperimentalAxoSegmentedControl } from './AxoSegmentedControl.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoSegmentedControl.dom.stories.tsx';

type TestControlProps = Readonly<{
  onValueChange?: (value: string | null) => void;
}>;

function TestControl(props: TestControlProps): ReactNode {
  const [value, setValue] = useState<string | null>('inbox');
  return (
    <ExperimentalAxoSegmentedControl.Root
      label="Folders"
      variant="track"
      width="fit"
      itemWidth="fit"
      value={value}
      onValueChange={nextValue => {
        setValue(nextValue);
        props.onValueChange?.(nextValue);
      }}
    >
      <ExperimentalAxoSegmentedControl.Item value="inbox">
        <ExperimentalAxoSegmentedControl.ItemText>
          Inbox
        </ExperimentalAxoSegmentedControl.ItemText>
        <ExperimentalAxoSegmentedControl.ItemBadge
          variant="primary"
          value={42}
          max={99}
          label="42 unread messages"
        />
      </ExperimentalAxoSegmentedControl.Item>
      <ExperimentalAxoSegmentedControl.Item value="drafts">
        <ExperimentalAxoSegmentedControl.ItemText>
          Drafts
        </ExperimentalAxoSegmentedControl.ItemText>
      </ExperimentalAxoSegmentedControl.Item>
    </ExperimentalAxoSegmentedControl.Root>
  );
}

function getItem(name: string) {
  return page.getByRole('radio', { name });
}

describe('AxoSegmentedControl', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: `primary` AxoBadge text doesn't have enough contrast in dark mode
      WithBadges: ['color-contrast'],
      LongNamesWithBadges: ['color-contrast'],
    },
  });

  test('clicking the selected item deselects it', async () => {
    const onValueChange = vi.fn<(value: string | null) => void>();
    await renderAxo(<TestControl onValueChange={onValueChange} />);

    await getItem('Inbox').click();
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(null);
    await expect.element(getItem('Inbox')).not.toBeChecked();
  });

  // TODO: Arrow keys should check the focused item like a radio group, or
  // items should be toggle buttons with `aria-pressed`
  test.fails('arrow keys select the focused item', async () => {
    await renderAxo(<TestControl />);

    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect.element(getItem('Drafts')).toHaveFocus();
    await expect.element(getItem('Drafts')).toBeChecked();
  });
});
