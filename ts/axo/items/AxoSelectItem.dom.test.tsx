// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { AxoSelectItem } from './AxoSelectItem.dom.tsx';
import { AxoItem } from './AxoItem.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoSelectItem.dom.stories.tsx';

type TestSelectItemProps = Readonly<{
  onValueChange?: (value: string) => void;
}>;

function TestSelectItem(props: TestSelectItemProps): ReactNode {
  return (
    <AxoItem.Group>
      <AxoSelectItem.Root
        label="Font size"
        description="Applies to messages"
        placeholder="Choose a size"
        value={null}
        onValueChange={value => props.onValueChange?.(value)}
        options={[
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg', disabled: true },
        ]}
      />
    </AxoItem.Group>
  );
}

describe('AxoSelectItem', () => {
  testStoriesWithAxe(stories);

  test('renders the options', async () => {
    const onValueChange = vi.fn<(value: string) => void>();
    const screen = await renderAxo(
      <TestSelectItem onValueChange={onValueChange} />
    );
    const listbox = page.getByRole('listbox');

    await screen.getByRole('combobox', { name: 'Font size' }).click();
    await expect
      .element(listbox.getByRole('option', { name: 'Large' }))
      .toHaveAttribute('aria-disabled', 'true');
    await listbox.getByRole('option', { name: 'Medium' }).click();
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('md');
  });
});
