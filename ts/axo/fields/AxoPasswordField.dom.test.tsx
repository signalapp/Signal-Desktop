// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { AxoPasswordField } from './AxoPasswordField.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { getTabSequence } from '../_test-helpers/a11y.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoPasswordField.dom.stories.tsx';

type TestPasswordFieldProps = Readonly<{
  id?: string;
  disabled?: boolean;
}>;

function TestPasswordField(props: TestPasswordFieldProps): ReactNode {
  const [value, setValue] = useState('hunter2');
  return (
    <AxoPasswordField.Root
      id={props.id}
      value={value}
      onValueChange={setValue}
      maxGraphemes={64}
      maxBytes={256}
      disabled={props.disabled}
    >
      <AxoPasswordField.Input
        placeholder="Enter your password"
        autoComplete="current-password"
      />
      <AxoPasswordField.Reveal />
    </AxoPasswordField.Root>
  );
}

describe('AxoPasswordField', () => {
  testStoriesWithAxe(stories);

  test('can be labelled with a visible label', async () => {
    const screen = await renderAxo(
      <>
        <label htmlFor="password">Password</label>
        <TestPasswordField id="password" />
      </>
    );
    await expect
      .element(screen.getByPlaceholder('Enter your password'))
      .toHaveAccessibleName('Password');
  });

  test('reveal button toggles the password visibility', async () => {
    const screen = await renderAxo(<TestPasswordField />);
    const input = screen.getByPlaceholder('Enter your password');
    const reveal = screen.getByRole('button', { name: 'Show Password' });

    await expect.element(input).toHaveAttribute('type', 'password');
    await expect.element(reveal).toHaveAttribute('aria-pressed', 'false');

    await reveal.click();
    await expect.element(reveal).toHaveAttribute('aria-pressed', 'true');
    await expect.element(input).toHaveAttribute('type', 'text');
    await expect.element(input).toHaveValue('hunter2');

    await reveal.click();
    await expect.element(reveal).toHaveAttribute('aria-pressed', 'false');
    await expect.element(input).toHaveAttribute('type', 'password');
  });

  test('disabled fields cannot be edited or revealed', async () => {
    const screen = await renderAxo(<TestPasswordField disabled />);
    const input = screen.getByPlaceholder('Enter your password');
    const reveal = screen.getByRole('button', { name: 'Show Password' });

    await expect.element(input).toBeDisabled();
    await expect.element(reveal).toHaveAttribute('aria-disabled', 'true');
    await expect(getTabSequence()).resolves.toStrictEqual([
      'button "Show Password"',
    ]);

    await reveal.click({ force: true });
    await expect.element(reveal).toHaveAttribute('aria-pressed', 'false');
    await expect.element(input).toHaveAttribute('type', 'password');
  });
});
