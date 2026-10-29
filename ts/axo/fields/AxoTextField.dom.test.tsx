// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { AxoTextField } from './AxoTextField.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { getTabSequence } from '../_test-helpers/a11y.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AxoTextField.dom.stories.tsx';

type TestTextFieldProps = Readonly<{
  defaultValue?: string;
  maxGraphemes?: number;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}>;

function TestTextField(props: TestTextFieldProps): ReactNode {
  const [value, setValue] = useState(props.defaultValue ?? '');
  return (
    <AxoTextField.Root
      value={value}
      onValueChange={nextValue => {
        setValue(nextValue);
        props.onValueChange?.(nextValue);
      }}
      maxGraphemes={props.maxGraphemes ?? 200}
      maxBytes={(props.maxGraphemes ?? 200) * 4}
      disabled={props.disabled}
      readOnly={props.readOnly}
    >
      <AxoTextField.Input placeholder="Name" />
      <AxoTextField.Clear />
      {props.children}
    </AxoTextField.Root>
  );
}

describe('AxoTextField', () => {
  testStoriesWithAxe(stories, {
    knownViolations: {
      // TODO: `.axo-field-error` text doesn't have enough contrast
      Error: ['color-contrast'],
      TextArea: ['color-contrast'],
    },
  });

  test('truncates to maxGraphemes', async () => {
    const onValueChange = vi.fn<(value: string) => void>();
    const screen = await renderAxo(
      <TestTextField maxGraphemes={5} onValueChange={onValueChange} />
    );
    const textbox = screen.getByRole('textbox', { name: 'Name' });

    await textbox.fill('Jamie Kyle');
    await expect.element(textbox).toHaveValue('Jamie');
    expect(onValueChange).toHaveBeenLastCalledWith('Jamie');
  });

  describe('clear button', () => {
    test('is hidden while the field is empty', async () => {
      const screen = await renderAxo(<TestTextField />);
      const clear = screen.getByRole('button', {
        name: 'Clear',
        includeHidden: true,
      });

      await expect.element(clear).not.toBeVisible();
      await expect(getTabSequence()).resolves.toStrictEqual(['textbox']);

      await screen.getByRole('textbox').fill('Jamie');
      await expect.element(clear).toBeVisible();
    });

    test('clears the value and focuses the input', async () => {
      const onValueChange = vi.fn<(value: string) => void>();
      const screen = await renderAxo(
        <TestTextField defaultValue="Jamie" onValueChange={onValueChange} />
      );
      const textbox = screen.getByRole('textbox', { name: 'Name' });
      const clear = screen.getByRole('button', { name: 'Clear' });

      await expect
        .element(clear)
        .toHaveAttribute('aria-controls', textbox.element().id);
      await clear.click();
      await expect.element(textbox).toHaveValue('');
      await expect.element(textbox).toHaveFocus();
      expect(onValueChange).toHaveBeenCalledExactlyOnceWith('');
    });
  });

  test('disabled fields cannot be cleared and actions stay focusable', async () => {
    const onAction = vi.fn<() => void>();
    const screen = await renderAxo(
      <TestTextField defaultValue="Jamie" disabled>
        <AxoTextField.Action
          label="More actions"
          symbol="more"
          onClick={onAction}
        />
      </TestTextField>
    );
    const action = screen.getByRole('button', { name: 'More actions' });

    await expect
      .element(
        screen.getByRole('button', { name: 'Clear', includeHidden: true })
      )
      .toBeDisabled();
    await expect(getTabSequence()).resolves.toStrictEqual([
      'button "More actions"',
    ]);
    await expect.element(action).toHaveAttribute('aria-disabled', 'true');
    await action.click({ force: true });
    expect(onAction).not.toHaveBeenCalled();
  });

  test('read-only fields cannot be cleared', async () => {
    const screen = await renderAxo(
      <TestTextField defaultValue="Jamie" readOnly />
    );
    await expect
      .element(screen.getByRole('textbox'))
      .toHaveAttribute('readonly');
    await expect
      .element(screen.getByRole('button', { name: 'Clear' }))
      .toBeDisabled();
  });

  describe('validation', () => {
    test('input is invalid and described by the validation error', async () => {
      const screen = await renderAxo(
        <TestTextField>
          <AxoTextField.ValidationError>
            Name is too short
          </AxoTextField.ValidationError>
        </TestTextField>
      );
      const textbox = screen.getByRole('textbox');
      const errorId = screen.getByText('Name is too short').element().id;

      await expect.element(textbox).toHaveAttribute('aria-invalid', 'true');
      await expect
        .element(textbox)
        .toHaveAccessibleDescription('Name is too short');
      expect(errorId).not.toBe('');
      await expect
        .element(textbox)
        .toHaveAttribute('aria-errormessage', errorId);
    });

    function TestValidation(): ReactNode {
      const [value, setValue] = useState('');
      return (
        <AxoTextField.Root
          value={value}
          onValueChange={setValue}
          maxGraphemes={200}
          maxBytes={800}
        >
          <AxoTextField.Input placeholder="Name" />
          {value.length < 3 && (
            <AxoTextField.ValidationError>
              Name is too short
            </AxoTextField.ValidationError>
          )}
        </AxoTextField.Root>
      );
    }

    test('input is valid again once the validation error is removed', async () => {
      const screen = await renderAxo(<TestValidation />);
      const textbox = screen.getByRole('textbox', { name: 'Name' });

      await expect.element(textbox).toHaveAttribute('aria-invalid', 'true');
      await textbox.fill('Jamie');
      await expect.element(textbox).not.toHaveAttribute('aria-invalid');
      await expect.element(textbox).not.toHaveAttribute('aria-describedby');
      await expect.element(textbox).not.toHaveAttribute('aria-errormessage');
    });

    test('remaining count describes the input while visible', async () => {
      const screen = await renderAxo(
        <TestTextField defaultValue="1234" maxGraphemes={10}>
          <AxoTextField.Count />
        </TestTextField>
      );
      const textbox = screen.getByRole('textbox');

      await expect.element(textbox).not.toHaveAttribute('aria-describedby');
      await textbox.fill('12345678');
      await expect.element(textbox).toHaveAccessibleDescription('2');
    });

    test('input is described by both the error and the count', async () => {
      const screen = await renderAxo(
        <TestTextField defaultValue="12345678" maxGraphemes={10}>
          <AxoTextField.Count />
          <AxoTextField.ValidationError>
            Name is too long
          </AxoTextField.ValidationError>
        </TestTextField>
      );
      await expect
        .element(screen.getByRole('textbox'))
        .toHaveAccessibleDescription('Name is too long 2');
    });
  });
});
