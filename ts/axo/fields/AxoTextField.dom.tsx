// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo } from 'react';
import type { FC, MouseEvent, ReactNode, Ref } from 'react';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { AxoBaseField } from './_AxoBaseField.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';

/**
 * A single-line text input with optional icons, action buttons, and
 * character/byte limiting.
 *
 * @example Anatomy
 * ```tsx
 * <AxoTextField.Root>
 *   <AxoTextField.Icon />
 *   <AxoTextField.Input />
 *   <AxoTextField.Count />
 *   <AxoTextField.Clear />
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

  export type RootProps = Readonly<{
    /** Provide your own id for the `<input>` to target with a `<label>`. Auto-generated if omitted. */
    id?: string;
    /** Controlled value of the input. */
    value: string;
    /** Called with the new value on every change. */
    onValueChange: (value: string) => void;
    /** Maximum number of Unicode grapheme clusters allowed. */
    maxGraphemes: number;
    /** Maximum number of UTF-8 bytes allowed. Should be ~4x the number of `maxGraphemes`. */
    maxBytes: number;
    /** Disables this input. Also disabled if `Root` has `disabled` set. */
    disabled?: boolean;
    /** Makes this input read-only. Also read-only if `Root` has `readOnly` set. */
    readOnly?: boolean;
    /** Should be `Icon`, `Input`, and `Action` elements. */
    children: ReactNode;
  }>;

  /**
   * Container for the text field.
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
   *   />
   * </AxoTextField.Root>
   * ```
   */
  export const Root: FC<RootProps> = memo(props => {
    const {
      id,
      value,
      onValueChange,
      maxGraphemes,
      maxBytes,
      disabled,
      readOnly,
      children,
    } = props;
    return (
      <AxoBaseField.Root
        variant="text"
        id={id}
        value={value}
        onValueChange={onValueChange}
        maxGraphemes={maxGraphemes}
        maxBytes={maxBytes}
        disabled={disabled}
        readOnly={readOnly}
      >
        {children}
      </AxoBaseField.Root>
    );
  });

  Root.displayName = 'AxoTextField.Root';

  /**
   * <AxoTextField.Input>
   * --------------------------------------------------------------------------
   */

  export type InputSizing = AxoBaseField.InputSizing;

  export type InputProps = AxoBaseField.PublicInputProps;

  /** The text input field. Must be placed inside `Root`. */
  export const Input: FC<InputProps> = memo(props => {
    return <AxoBaseField.Input {...props} type="text" />;
  });

  Input.displayName = 'AxoTextField.Input';

  /**
   * <AxoTextField.Input>
   * --------------------------------------------------------------------------
   */

  export type TextAreaProps = AxoBaseField.TextAreaProps;

  export const TextArea: FC<TextAreaProps> = memo(props => {
    return <AxoBaseField.TextArea {...props} />;
  });

  TextArea.displayName = 'AxoTextField.TextArea';

  /**
   * <AxoTextField.Count>
   * --------------------------------------------------------------------------
   */

  export const Count: FC = memo(() => {
    return <AxoBaseField.Count />;
  });

  Count.displayName = 'AxoTextField.Count';

  /**
   * <AxoTextField.Clear>
   * --------------------------------------------------------------------------
   */

  export type ClearProps = Readonly<{
    forceShow?: boolean;
  }>;

  export const Clear: FC<ClearProps> = memo(props => {
    return <AxoBaseField.Clear forceShow={props.forceShow} />;
  });

  Clear.displayName = 'AxoTextField.Clear';

  /**
   * <AxoTextField.Icon>
   * --------------------------------------------------------------------------
   */

  export type IconProps = Readonly<{
    /** Leading icon displayed before the input. */
    symbol: AxoSymbol.Name;
  }>;

  export const Icon: FC<IconProps> = memo(props => {
    return <AxoBaseField.Icon symbol={props.symbol} />;
  });

  Icon.displayName = 'AxoTextField.Icon';

  /**
   * <AxoTextField.Action>
   * --------------------------------------------------------------------------
   */

  export type ActionProps = Readonly<{
    /** Ref for the action button element. */
    ref?: Ref<HTMLButtonElement>;
    /** Accessible label for the button describing the action to be taken, not the icon. */
    label: string;
    /** Icon to display inside the button. */
    symbol: AxoSymbol.Name;
    /** Called when the button is clicked. */
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    /** Overrides the `disabled` state from `Root` for this button only. */
    disabled?: boolean;
    /** Placement of the action button, either 'leading' or 'trailing' (default). */
    slot?: AxoBaseField.Slot;
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
    const { ref, label, onClick, disabled, slot, symbol, ...rest } = props;
    return (
      <AxoBaseField.Action
        ref={ref}
        label={label}
        symbol={symbol}
        onClick={onClick}
        disabled={disabled}
        slot={slot}
        {...forwardExtraPropsForRadix(rest)}
      />
    );
  });

  Action.displayName = 'AxoTextField.Action';

  /**
   * <AxoTextField.LoadingIndicator>
   * --------------------------------------------------------------------------
   */

  export type LoadingIndicatorProps = Readonly<{
    pending: boolean;
  }>;

  export const LoadingIndicator: FC<LoadingIndicatorProps> = memo(props => {
    return <AxoBaseField.LoadingIndicator pending={props.pending} />;
  });

  LoadingIndicator.displayName = 'AxoTextField.LoadingIndicator';

  /**
   * <AxoTextField.ValidationError>
   * --------------------------------------------------------------------------
   */

  export type ValidationErrorProps = Readonly<{
    children: ReactNode;
  }>;

  export const ValidationError: FC<ValidationErrorProps> = memo(props => {
    return (
      <AxoBaseField.ValidationError>
        {props.children}
      </AxoBaseField.ValidationError>
    );
  });

  ValidationError.displayName = 'AxoTextField.ValidationError';

  /**
   * <AxoTextField.CustomLeadingSlot>
   * --------------------------------------------------------------------------
   */

  export type CustomLeadingSlotProps = Readonly<{
    children: ReactNode;
  }>;

  export const CustomLeadingSlot: FC<CustomLeadingSlotProps> = memo(props => {
    return (
      <AxoBaseField.CustomLeadingSlot>
        {props.children}
      </AxoBaseField.CustomLeadingSlot>
    );
  });

  CustomLeadingSlot.displayName = 'AxoTextField.CustomLeadingSlot';

  /**
   * <AxoTextField.CustomTrailingSlot>
   * --------------------------------------------------------------------------
   */

  export type CustomTrailingSlotProps = Readonly<{
    children: ReactNode;
  }>;

  export const CustomTrailingSlot: FC<CustomTrailingSlotProps> = memo(props => {
    return (
      <AxoBaseField.CustomTrailingSlot>
        {props.children}
      </AxoBaseField.CustomTrailingSlot>
    );
  });

  CustomTrailingSlot.displayName = 'AxoTextField.CustomTrailingSlot';

  /**
   * <AxoTextField.CustomAction>
   * --------------------------------------------------------------------------
   */

  export type CustomActionProps = AxoBaseField.CustomActionProps;

  export const CustomAction: FC<CustomActionProps> = memo(props => {
    return <AxoBaseField.CustomAction {...props} />;
  });

  CustomAction.displayName = 'AxoTextField.CustomAction';
}
