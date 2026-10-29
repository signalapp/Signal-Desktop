// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { AxoFieldGroup } from './AxoFieldGroup.dom.tsx';
import { AxoTextField } from './AxoTextField.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoFieldGroup.dom.stories.tsx';

function TestField(props: Readonly<{ placeholder: string }>): ReactNode {
  return (
    <AxoTextField.Root
      value="Jamie"
      onValueChange={vi.fn()}
      maxGraphemes={200}
      maxBytes={800}
    >
      <AxoTextField.Input placeholder={props.placeholder} />
      <AxoTextField.Clear />
    </AxoTextField.Root>
  );
}

describe('AxoFieldGroup', () => {
  testStoriesWithAxe(stories);

  test('disabled groups disable every field', async () => {
    const screen = await renderAxo(
      <AxoFieldGroup.Root disabled>
        <TestField placeholder="Given name" />
        <AxoFieldGroup.Separator />
        <TestField placeholder="Family name" />
      </AxoFieldGroup.Root>
    );
    for (const element of [
      ...screen.getByRole('textbox').all(),
      ...screen.getByRole('button').all(),
    ]) {
      // oxlint-disable-next-line no-await-in-loop
      await expect.element(element).toBeDisabled();
    }
  });

  test('read-only groups make every field read-only', async () => {
    const screen = await renderAxo(
      <AxoFieldGroup.Root readOnly>
        <TestField placeholder="Given name" />
        <AxoFieldGroup.Separator />
        <TestField placeholder="Family name" />
      </AxoFieldGroup.Root>
    );
    for (const textbox of screen.getByRole('textbox').all()) {
      // oxlint-disable-next-line no-await-in-loop
      await expect.element(textbox).toHaveAttribute('readonly');
    }
  });
});
