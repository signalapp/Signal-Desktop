// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import { AxoSelect } from './AxoSelect.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoSelect.dom.stories.tsx';

type TestSelectProps = Readonly<{
  label?: string;
}>;

function TestSelect(props: TestSelectProps): ReactNode {
  const [value, setValue] = useState<string | null>(null);
  return (
    <>
      <AxoSelect.Root
        label={props.label}
        value={value}
        onValueChange={setValue}
      >
        <AxoSelect.Trigger placeholder="Choose a food" />
        <AxoSelect.Content>
          <AxoSelect.Item value="apple">
            <AxoSelect.ItemText>Apple</AxoSelect.ItemText>
          </AxoSelect.Item>
          <AxoSelect.Item value="banana">
            <AxoSelect.ItemText>Banana</AxoSelect.ItemText>
          </AxoSelect.Item>
        </AxoSelect.Content>
      </AxoSelect.Root>
      <button type="button" onClick={() => setValue(null)}>
        Reset
      </button>
    </>
  );
}

// The listbox is portalled outside of the render container
const listbox = page.getByRole('listbox');
// The rest of the page is `aria-hidden` while the listbox is open
const trigger = page.getByRole('combobox', { includeHidden: true });

describe('AxoSelect', () => {
  testStoriesWithAxe(stories);

  test('shows the placeholder when the value is reset to null', async () => {
    const screen = await renderAxo(<TestSelect label="Food" />);

    await trigger.click();
    await listbox.getByRole('option', { name: 'Banana' }).click();
    await expect.element(trigger).toMatchTextContent('Banana');

    await screen.getByRole('button', { name: 'Reset' }).click();
    await expect.element(trigger).toMatchTextContent('Choose a food');

    await trigger.click();
    await expect
      .element(listbox.getByRole('option', { name: 'Banana' }))
      .toHaveAttribute('aria-selected', 'false');
  });
});
