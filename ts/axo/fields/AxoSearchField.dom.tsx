// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, FocusEvent, ReactNode } from 'react';
import { memo } from 'react';
import { AxoBaseField } from './_AxoBaseField.dom.tsx';
import { UnitBytes } from '@signalapp/types';

/**
 * @example Anatomy
 * ```tsx
 * <AxoSearchField.Root>
 *   <AxoSearchField.Icon />
 *   <AxoSearchField.Input />
 *   <AxoSearchField.Clear />
 * </AxoSearchField.Root>
 * ```
 */
export namespace AxoSearchField {
  /**
   * <AxoSearchField.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    /** Provide your own id for the `<input>` to target with a `<label>`. Auto-generated if omitted. */
    id?: string;
    /** Disables this input. */
    disabled?: boolean;
    /** Controlled value of the input. */
    value: string;
    /** Called with the new value on every change. */
    onValueChange: (value: string) => void;
    /** Maximum number of bytes allowed in the input. */
    maxBytes?: number;
    /** Maximum number of graphemes allowed in the input. */
    maxGraphemes?: number;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const { value, onValueChange, disabled, children } = props;
    return (
      <AxoBaseField.Root
        variant="search"
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        maxBytes={props.maxBytes ?? UnitBytes.KILOBYTE}
        maxGraphemes={props.maxGraphemes ?? UnitBytes.KILOBYTE}
      >
        {children}
      </AxoBaseField.Root>
    );
  });

  Root.displayName = 'AxoSearchField.Root';

  /**
   * <AxoSearchField.Icon>
   * --------------------------------------------------------------------------
   */

  export const Icon: FC = memo(() => {
    return <AxoBaseField.Icon symbol="search" />;
  });

  Icon.displayName = 'AxoSearchField.Icon';

  /**
   * <AxoSearchField.Input>
   * --------------------------------------------------------------------------
   */

  export type InputProps = Readonly<{
    /** Placeholder text shown when the input is empty. */
    placeholder: string;
    /** Focuses the input on mount. */
    autoFocus?: boolean;
    /** Called when the input receives focus. */
    onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
    /** Called when the input loses focus. */
    onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  }>;

  export const Input: FC<InputProps> = memo(props => {
    const { placeholder, autoFocus, onFocus, onBlur } = props;
    return (
      <AxoBaseField.Input
        type="search"
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    );
  });

  Input.displayName = 'AxoSearchField.Input';

  /**
   * <AxoSearchField.Clear>
   * --------------------------------------------------------------------------
   */

  export const Clear: FC = memo(() => {
    return <AxoBaseField.Clear />;
  });

  Clear.displayName = 'AxoSearchField.Clear';
}
