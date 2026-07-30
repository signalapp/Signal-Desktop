// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo } from 'react';
import type { FC, MouseEvent, ReactNode, RefObject } from 'react';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoBaseField } from './_AxoBaseField.dom.tsx';

/**
 * A single-line text input with optional icons, action buttons, and
 * character/byte limiting.
 *
 * @example Anatomy
 * ```tsx
 * <AxoTextField.Root>
 *   <AxoTextField.Input />
 *   <AxoTextField.Separator />
 *   <AxoTextField.Input />
 *   <AxoTextField.Action />
 * </AxoTextField.Root>
 * ```
 * @see {@link https://w3c.github.io/aria/#textbox | `textbox` role - WAI-ARIA 1.3}
 * @see {@link https://w3c.github.io/aria/#group | `group` role - WAI-ARIA 1.3}
 */
export namespace AxoTextField {
  /**
   * <AxoTextField.Root>
   * --------------------------------------------------------------------------
   */

  /**
   * The preferred width of the text field.
   *
   * TODO(jamie): Get real sizes from design
   *
   * - `xs` – 200px
   * - `sm` – 300px
   * - `md` – 400px
   * - `lg` – 500px
   * - `xl` – 600px
   * - `full` – stretches to fill the container (default)
   *
   * All sizes shrink to fit the container if it is narrower than the minimum.
   */
  export type Width = AxoBaseField.Width;

  export type RootProps = Readonly<{
    /** Leading icon displayed before the input. */
    symbol?: AxoSymbol.IconName;
    /** Controls the width of the entire field. Defaults to `full`. */
    width?: AxoBaseField.Width;
    /** Disables all inputs and actions within the field. */
    disabled?: boolean;
    /** Makes all inputs within the field read-only. */
    readOnly?: boolean;
    /** Should be `Input`, `Action`, and/or `Separator` elements. */
    children: ReactNode;
  }>;

  /**
   * Container for the text field. Provides shared `disabled`/`readOnly` state
   * to child inputs and actions.
   *
   * @example Basic usage
   * ```tsx
   * <AxoTextField.Root>
   *   <AxoTextField.Input
   *     placeholder="First name"
   *     value={value}
   *     onValueChange={setValue}
   *     maxGraphemes={26}
   *     maxBytes={128}
   *     showCount
   *     showClear
   *   />
   * </AxoTextField.Root>
   * ```
   *
   * @example Segmented field with icon and action
   * ```tsx
   * <AxoTextField.Root symbol="at">
   *   <AxoTextField.Input placeholder="Username" sizing="grow" ... />
   *   <AxoTextField.Separator />
   *   <AxoTextField.Input placeholder="00" sizing="fit" ... />
   *   <AxoTextField.Action label="Insert emoji" symbol="emoji" onClick={openEmojiPicker} />
   * </AxoTextField.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    return (
      <AxoBaseField.Group disabled={props.disabled} readOnly={props.readOnly}>
        <AxoBaseField.Container variant="text" width={props.width}>
          {props.symbol != null && <AxoBaseField.Icon symbol={props.symbol} />}
          {props.children}
        </AxoBaseField.Container>
      </AxoBaseField.Group>
    );
  });

  Root.displayName = 'AxoTextField.Root';

  /**
   * <AxoTextField.Input>
   * --------------------------------------------------------------------------
   */

  export type InputSizing = AxoBaseField.InputSizing;

  export type InputProps = Readonly<{
    /** Ref to the underlying `<input>` element. */
    ref?: RefObject<HTMLInputElement | null>;
    /** Provide your own id for the `<input>` to target with a `<label>`. Auto-generated if omitted. */
    id?: string;
    /** Form field name for native form submissions. */
    name?: string;
    /** Placeholder text shown when the input is empty. */
    placeholder: string;
    /** How the input sizes itself within the field group. Defaults to `fixed`. */
    sizing?: InputSizing;
    /** Controlled value of the input. */
    value: string;
    /** Called with the new value on every change. */
    onValueChange: (value: string) => void;
    /** Maximum number of Unicode grapheme clusters allowed. */
    maxGraphemes: number;
    /** Maximum number of UTF-8 bytes allowed. Should be ~4x the number of `maxGraphemes`. */
    maxBytes: number;
    /** Shows a remaining-character counter that appears as the limit is approached. */
    showCount?: boolean;
    /** Shows a clear button when the input has a value. */
    showClear?: boolean;
    /** Marks the input as required for form validation. */
    required?: boolean;
    /** Disables this input. Also disabled if `Root` has `disabled` set. */
    disabled?: boolean;
    /** Makes this input read-only. Also read-only if `Root` has `readOnly` set. */
    readOnly?: boolean;
    /** Focuses the input on mount. */
    autoFocus?: boolean;
    /** Enables or disables browser spell checking. */
    spellCheck?: boolean;
    /** Prefer using the specific axo component for the input type (See: <AxoPasswordField> or <AxoSearchField>) */
    type?: never;
  }>;

  /** The text input field. Must be placed inside `Root`. */
  export const Input: FC<InputProps> = memo(props => {
    return (
      <AxoBaseField.Segment
        id={props.id}
        value={props.value}
        onValueChange={props.onValueChange}
        maxGraphemes={props.maxGraphemes}
        maxBytes={props.maxBytes}
        disabled={props.disabled}
        readOnly={props.readOnly}
      >
        <AxoBaseField.Input
          type="text" // Note: Do not customize here, prefer creating more specific axo components
          ref={props.ref}
          name={props.name}
          placeholder={props.placeholder}
          sizing={props.sizing}
          required={props.required}
          autoFocus={props.autoFocus}
          spellCheck={props.spellCheck}
        />
        {props.showCount && (
          <AxoBaseField.RemainingCount
            maxGraphemes={props.maxGraphemes}
            maxBytes={props.maxBytes}
          />
        )}
        {props.showClear && <AxoBaseField.Clear />}
      </AxoBaseField.Segment>
    );
  });

  Input.displayName = 'AxoTextField.Input';

  /**
   * <AxoTextField.Action>
   * --------------------------------------------------------------------------
   */

  export type ActionProps = Readonly<{
    /** Accessible label for the button describing the action to be taken, not the icon. */
    label: string;
    /** Icon to display inside the button. */
    symbol: AxoSymbol.IconName;
    /** Called when the button is clicked. */
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    /** Overrides the `disabled` state from `Root` for this button only. */
    disabled?: boolean;
  }>;

  /**
   * An icon button placed inside a `Root`, typically used for supplementary
   * actions like inserting an emoji or opening a menu.
   *
   * @example
   * ```tsx
   * <AxoTextField.Root>
   *   <AxoTextField.Input ... />
   *   <AxoTextField.Action label="Insert emoji" symbol="emoji" onClick={openEmojiPicker} />
   * </AxoTextField.Root>
   * ```
   */
  export const Action: FC<ActionProps> = memo(props => {
    return (
      <AxoBaseField.Action
        label={props.label}
        symbol={props.symbol}
        onClick={props.onClick}
        disabled={props.disabled}
      />
    );
  });

  Action.displayName = 'AxoTextField.Action';

  /**
   * <AxoTextField.Separator>
   * --------------------------------------------------------------------------
   */

  /**
   * A vertical divider between segments in a multi-input field.
   *
   * @example Username + discriminator
   * ```tsx
   * <AxoTextField.Root symbol="at">
   *   <AxoTextField.Input placeholder="Username" sizing="grow" ... />
   *   <AxoTextField.Separator />
   *   <AxoTextField.Input placeholder="00" sizing="fit" ... />
   * </AxoTextField.Root>
   * ```
   */
  export const Separator: FC = memo(() => {
    return <AxoBaseField.Separator />;
  });

  Separator.displayName = 'AxoTextField.Separator';
}
