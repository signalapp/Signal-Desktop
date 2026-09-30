// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useCallback, useId, useMemo, useRef } from 'react';
import type {
  FC,
  FocusEvent,
  InputEvent,
  MouseEvent,
  ReactNode,
  Ref,
  RefObject,
  SyntheticEvent,
  JSX,
  CSSProperties,
} from 'react';
import { mergeProps } from '@react-aria/utils';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { assert } from '../_internal/assert.std.tsx';
import { utf8 } from '../_internal/utf8.std.ts';
import {
  createStrictContext,
  useStrictContext,
  useStrictContextNullable,
} from '../_internal/StrictContext.dom.tsx';
import { useAxoIntl } from '../_internal/AxoIntl.dom.tsx';
import { variants } from '../_internal/variants.dom.tsx';
import { css } from '../_internal/css.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import { tw, type TailwindStyles } from '../tw.dom.tsx';
import { AxoLoadingIndicator } from '../status/AxoLoadingIndicator.dom.tsx';
import type { Simplify } from 'type-fest';

export namespace AxoBaseField {
  /**
   * Visual style of the field.
   */
  export type Variant = 'text' | 'search' | 'listitem';

  const Variants = variants<Variant>('AxoBaseField.Variant', {
    text: css('axo-field-container-text'),
    search: css('axo-field-container-search'),
    listitem: css('axo-field-container-listitem'),
  });

  function getContainerClassName(variant: Variant = 'text'): TailwindStyles {
    return css('axo-field-container', Variants.get(variant));
  }

  /** Placement of the action button, either 'leading' or 'trailing' (default). */
  export type Slot = 'leading' | 'trailing';

  const Slots = variants<Slot>('AxoBaseField.Slot', {
    leading: css('axo-field-leading'),
    trailing: css('axo-field-trailing'),
  });

  /**
   * <AxoBaseField.VariantOverride>
   * --------------------------------------------------------------------------
   */

  const VariantOverrideContext = createStrictContext<Variant>(
    'AxoBaseField.VariantProvider'
  );

  export type VariantOverrideProps = Readonly<{
    variant: Variant;
    children: ReactNode;
  }>;

  export const VariantOverride: FC<VariantOverrideProps> = memo(props => {
    return (
      <VariantOverrideContext value={props.variant}>
        {props.children}
      </VariantOverrideContext>
    );
  });

  VariantOverride.displayName = 'AxoBaseField.VariantOverride';

  /**
   * The type of input control to render.
   * Note: Only include `type`'s relevant to text inputs.
   */
  export type Type =
    | 'email'
    | 'number'
    | 'password'
    | 'search'
    | 'tel'
    | 'text'
    | 'url';

  /**
   * Specifies what type of virtual keyboard to use.
   * Note: Only include `inputMode`'s relevant to text fields.
   */
  export type InputMode =
    | 'none'
    | 'text'
    | 'tel'
    | 'url'
    | 'email'
    | 'numeric'
    | 'decimal'
    | 'search';

  /**
   * Hint for form autofill feature.
   */
  export type AutoComplete = AutoFill;

  /**
   * Toggle auto-correction of spelling and punctuation errors.
   */
  export type AutoCorrect = 'on' | 'off';

  /**
   * Toggle whether inputted text is automatically capitalized, and if so, in what manner.
   */
  export type AutoCapitalize =
    | 'on'
    | 'off'
    | 'sentences'
    | 'words'
    | 'characters'
    | 'none';

  /**
   * Define what action label (or icon) to present for the enter key on virtual keyboards.
   */
  export type EnterKeyHint =
    | 'enter'
    | 'done'
    | 'go'
    | 'next'
    | 'previous'
    | 'search'
    | 'send';

  export type BaseTextboxAttrs<T extends HTMLElement> = Readonly<{
    /** Ref to the underlying `<input>` element. */
    ref?: RefObject<T | null>;
    /** Form field name for native form submissions. */
    name?: string;
    /** Placeholder text shown when the textbox is empty. */
    placeholder: string;
    /** Marks the textbox as required for form validation. */
    required?: boolean;
    /** Focuses the textbox on mount. */
    autoFocus?: boolean;
    /** Called when the textbox receives focus. */
    onFocus?: (event: FocusEvent<T>) => void;
    /** Called when the textbox loses focus. */
    onBlur?: (event: FocusEvent<T>) => void;
  }>;

  export type BaseTextboxVariantProps = Readonly<{
    /** Override font settings to give numbers uniform/tabular widths. */
    tabularNums?: boolean;
  }>;

  export type KeyboardTextboxAttrs = Readonly<{
    /** Specifies what type of virtual keyboard to use. */
    inputMode?: InputMode;
    /** Hint for form autofill feature. */
    autoComplete?: AutoComplete;
    /** Toggle auto-correction of spelling and punctuation errors. */
    autoCorrect?: AutoCorrect;
    /** Toggle whether inputted text is automatically capitalized, and if so, in what manner. */
    autoCapitalize?: AutoCapitalize;
    /** Define what action label (or icon) to present for the enter key on virtual keyboards. */
    enterKeyHint?: EnterKeyHint;
    /** Enables or disables browser spell checking. */
    spellCheck?: boolean;
  }>;

  export type TextValidationTextboxAttrs = Readonly<{
    /** Min string length (in UTF-16 code units) that the user can input. */
    minLength?: number;
    /** Max string length (in UTF-16 code units) that the user can input. */
    maxLength?: number;
    /** A regex that the input's value must match. */
    pattern?: string;
    /**
     * The default width of the input based on character size.
     * A useful visual hint for the expected length of an input.
     */
    size?: number;
  }>;

  export type NumberValidationInputAttrs = Readonly<{
    /** Min number in the range of permitted values */
    min?: number;
    /** Max number in the range of permitted values */
    max?: number;
    /** Specifies the granularity that the value must adhere to. */
    step?: number;
  }>;

  /**
   * <AxoBaseField.Group>
   * --------------------------------------------------------------------------
   */

  type GroupContextType = Readonly<{
    disabled?: boolean;
    readOnly?: boolean;
  }>;

  const GroupContext =
    createStrictContext<GroupContextType>('AxoBaseField.Group');

  export type GroupProps = Readonly<{
    variant?: Variant;
    /** Disables all textboxes and actions within the field. */
    disabled?: boolean;
    /** Makes all textboxes within the field read-only. */
    readOnly?: boolean;
    /** Should be `Segment`, `Action`, and/or `Separator` elements. */
    children: ReactNode;
  }>;

  export const Group: FC<GroupProps> = memo(props => {
    const { variant: propsVariant, disabled, readOnly, children } = props;
    const variantOverride = useStrictContextNullable(VariantOverrideContext);

    const variant = variantOverride ?? propsVariant;

    const context = useMemo((): GroupContextType => {
      return { disabled, readOnly };
    }, [disabled, readOnly]);

    return (
      <GroupContext.Provider value={context}>
        <div
          role="group"
          className={css('axo-field-group', getContainerClassName(variant))}
        >
          {children}
        </div>
      </GroupContext.Provider>
    );
  });

  Group.displayName = 'AxoBaseField.Group';

  /**
   * <AxoBaseField.Root>
   * --------------------------------------------------------------------------
   */

  type RootContextType = Readonly<{
    textFieldRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
    textFieldId: string;
    value: string;
    onValueChange: (value: string) => void;
    maxGraphemes: number;
    maxBytes: number;
    disabled: boolean;
    readOnly: boolean;
  }>;

  const RootContext = createStrictContext<RootContextType>('AxoBaseField.Root');

  export type RootProps = Readonly<{
    /** Visual style of the field. */
    variant?: Variant;
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
    /** Should be `Icon`, `Separator`, and/or `Action` elements. */
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const {
      variant: propsVariant,
      id: propsId,
      value,
      onValueChange,
      maxGraphemes,
      maxBytes,
      disabled: fieldDisabled,
      readOnly: fieldReadOnly,
      children,
    } = props;

    const textFieldRef = useRef<HTMLInputElement>(null);
    const fallbackId = useId();
    const textFieldId = propsId ?? fallbackId;

    const variantOverride = useStrictContextNullable(VariantOverrideContext);
    const group = useStrictContextNullable(GroupContext);

    const variant = variantOverride ?? propsVariant;

    const disabled = group?.disabled === true || fieldDisabled === true;
    const readOnly = group?.readOnly === true || fieldReadOnly === true;

    const context = useMemo((): RootContextType => {
      return {
        textFieldRef,
        textFieldId,
        value,
        onValueChange,
        maxGraphemes,
        maxBytes,
        disabled,
        readOnly,
      };
    }, [
      textFieldRef,
      textFieldId,
      value,
      onValueChange,
      maxGraphemes,
      maxBytes,
      disabled,
      readOnly,
    ]);

    return (
      <RootContext value={context}>
        <div
          className={css(
            'axo-field-root',
            group == null && getContainerClassName(variant)
          )}
        >
          {children}
        </div>
      </RootContext>
    );
  });

  Root.displayName = 'AxoBaseField.Root';

  /**
   * <AxoBaseField.Icon>
   * --------------------------------------------------------------------------
   */

  export type IconProps = Readonly<{
    symbol: AxoSymbol.Name;
  }>;

  export const Icon: FC<IconProps> = memo(props => {
    return (
      <span className={css(Slots.get('leading'), 'axo-field-icon')}>
        <AxoSymbol.Icon size={16} symbol={props.symbol} label={null} />
      </span>
    );
  });

  Icon.displayName = 'AxoBaseField.Icon';

  /**
   * useTextField()
   * --------------------------------------------------------------------------
   */

  /** @internal */
  type TextFieldTypes = Pick<JSX.IntrinsicElements, 'input' | 'textarea'>;

  /** @internal */
  function useTextField<T extends keyof TextFieldTypes>(
    props: TextFieldTypes[T],
    innerProps: TextFieldTypes[T]
  ): TextFieldTypes[T] {
    const context = useStrictContext(RootContext);

    const {
      textFieldRef,
      textFieldId,
      value,
      disabled,
      readOnly,
      maxGraphemes,
      maxBytes,
      onValueChange,
    } = context;

    const onBeforeInput = useCallback(
      (event: InputEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        event.stopPropagation();

        if (disabled || readOnly) {
          event.preventDefault();
          return;
        }

        const input = event.currentTarget;
        const current = input.value;

        const start = input.selectionStart ?? current.length;
        const end = input.selectionEnd ?? start;

        const prefix = current.substring(0, start);
        const suffix = current.substring(end);
        const inserted = event.data;

        const updated = `${prefix}${inserted}${suffix}`;
        const updatedBytes = utf8.getByteLength(updated);
        const updatedGraphemes = utf8.getGraphemeCount(updated);

        if (updatedBytes <= maxBytes && updatedGraphemes <= maxGraphemes) {
          return;
        }

        const base = `${prefix}${suffix}`;
        const baseBytes = utf8.getByteLength(base);
        const baseGraphemes = utf8.getGraphemeCount(base);

        let result = '';
        result += prefix;

        const remainingBytes = maxBytes - baseBytes;
        const remainingChars = maxGraphemes - baseGraphemes;
        result += utf8.truncateBytesAndGraphemes(
          inserted,
          remainingBytes,
          remainingChars
        );

        result += suffix;

        // Simulate the input as if we had just enough room
        // for exactly the bytes we want to let through
        const prevMaxLength = input.getAttribute('maxlength');
        input.maxLength = result.length;
        requestAnimationFrame(() => {
          if (input.maxLength !== result.length) {
            return; // changed elsewhere
          }
          if (prevMaxLength == null) {
            input.removeAttribute('maxlength');
          } else {
            input.setAttribute('maxlength', prevMaxLength);
          }
        });
      },
      [disabled, readOnly, maxGraphemes, maxBytes]
    );

    const onInput = useCallback(
      (event: InputEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        event.stopPropagation();

        if (disabled || readOnly) {
          event.preventDefault();
          return;
        }

        const input = event.currentTarget;
        const current = input.value;

        const truncated = utf8.truncateBytesAndGraphemes(
          current,
          maxBytes,
          maxGraphemes
        );

        onValueChange(truncated);
      },
      [disabled, readOnly, maxGraphemes, maxBytes, onValueChange]
    );

    const onInvalid = useCallback((event: SyntheticEvent) => {
      // Prevent the native browser validation UI from appearing
      event.preventDefault();
    }, []);

    return mergeProps(
      {
        ref: textFieldRef,
        id: textFieldId,
        value,
        disabled,
        readOnly,
        onBeforeInput,
        onInput,
        onInvalid,
      },
      props,
      innerProps
    ) as TextFieldTypes[T];
  }

  /**
   * <AxoBaseField.Input>
   * --------------------------------------------------------------------------
   */

  export type InputSizing = 'fill' | 'fit';

  type InputStylingProps = Readonly<{
    /** How the field sizes itself horizontally. */
    sizing?: InputSizing;
    /** Override font settings to give numbers uniform/tabular widths. */
    tabularNums?: boolean;
  }>;

  type BaseInputProps = BaseTextboxAttrs<HTMLInputElement> &
    KeyboardTextboxAttrs &
    TextValidationTextboxAttrs &
    NumberValidationInputAttrs &
    InputStylingProps;

  export type PublicInputProps = Simplify<
    BaseInputProps &
      Readonly<{
        /** Prefer using the specific axo component for the input type (See: <AxoPasswordField> or <AxoSearchField>) */
        type?: never;
      }>
  >;

  export type InternalInputProps = BaseInputProps &
    Readonly<{
      /** The HTML input type. */
      type?: Type;
    }>;

  /** The text input field. Must be placed inside `Root`. */
  export const Input: FC<InternalInputProps> = memo(props => {
    const { tabularNums, sizing, ...rest } = props;

    const inputAttrs = useTextField<'input'>(rest, {
      className: css(
        'axo-field-textbox',
        sizing === 'fit' && 'axo-field-textbox-fit',
        tabularNums && tw('tabular-nums')
      ),
    });

    return (
      <div className="axo-field-textbox-wrapper">
        <input {...inputAttrs} />
      </div>
    );
  });

  Input.displayName = 'AxoBaseField.Input';

  /**
   * <AxoBaseField.TextArea>
   * --------------------------------------------------------------------------
   */

  export type MinLines = 1 | 2;
  // oxlint-disable-next-line typescript/ban-types
  export type MaxLines = 1 | 2 | 3 | 4 | 5 | (number & {});

  type TextAreaStylingProps = Readonly<{
    /** Minimum number of lines to display for the text area. */
    minLines?: MinLines;
    /** Maximum number of lines to display for the text area. */
    maxLines?: MaxLines;
    /** Override font settings to give numbers uniform/tabular widths. */
    tabularNums?: boolean;
  }>;

  export type TextAreaProps = BaseTextboxAttrs<HTMLTextAreaElement> &
    KeyboardTextboxAttrs &
    TextValidationTextboxAttrs &
    TextAreaStylingProps;

  export const TextArea: FC<TextAreaProps> = memo(props => {
    const { minLines = 1, maxLines = 5, tabularNums, ...rest } = props;

    assert(
      minLines <= maxLines,
      `minLines (${minLines}) must be <= than maxLines (${maxLines})`
    );

    const style = useMemo((): CSSProperties => {
      return {
        minHeight: `${minLines}lh`,
        maxHeight: `${maxLines}lh`,
      };
    }, [minLines, maxLines]);

    const textAreaAttrs = useTextField<'textarea'>(rest, {
      className: css('axo-field-textbox', tabularNums && tw('tabular-nums')),
      style,
    });

    return (
      <div className="axo-field-textbox-wrapper">
        <textarea {...textAreaAttrs} />
      </div>
    );
  });

  TextArea.displayName = 'AxoBaseField.TextArea';

  /**
   * <AxoBaseField.Count>
   * --------------------------------------------------------------------------
   */

  const SHOW_REMAINING_COUNT_THRESHOLD = 0.5;
  const WARN_REMAINING_COUNT_THRESHOLD = 0.25;

  export const Count: FC = memo(() => {
    const { value, maxBytes, maxGraphemes, disabled, readOnly } =
      useStrictContext(RootContext);

    const [remainingCount, maxCountForRemaining] = useMemo(() => {
      if (value.length === 0) {
        return [maxGraphemes, maxGraphemes];
      }

      const totalBytes = utf8.getByteLength(value);
      const totalGraphemes = utf8.getGraphemeCount(value);

      const remainingBytes = maxBytes - totalBytes;
      const remainingChars = maxGraphemes - totalGraphemes;

      if (remainingBytes > remainingChars) {
        return [remainingChars, maxGraphemes];
      }

      return [remainingBytes, maxBytes];
    }, [value, maxBytes, maxGraphemes]);

    const showRemainingCount = useMemo(() => {
      const threshold = maxCountForRemaining * SHOW_REMAINING_COUNT_THRESHOLD;
      return remainingCount <= threshold;
    }, [maxCountForRemaining, remainingCount]);

    const warnRemainingCount = useMemo(() => {
      const threshold = maxCountForRemaining * WARN_REMAINING_COUNT_THRESHOLD;
      return remainingCount <= threshold;
    }, [maxCountForRemaining, remainingCount]);

    return (
      <span
        className={css(
          'axo-field-count',
          !showRemainingCount && 'axo-field-count-invisible',
          warnRemainingCount && 'axo-field-count-warn',
          (disabled || readOnly) && 'axo-field-count-disabled'
        )}
      >
        {remainingCount}
      </span>
    );
  });

  Count.displayName = 'AxoBaseField.Count';

  /**
   * <AxoBaseField.Clear>
   * --------------------------------------------------------------------------
   */

  export type ClearProps = Readonly<{
    forceShow?: boolean;
  }>;

  export const Clear: FC<ClearProps> = memo(props => {
    const { forceShow } = props;
    const {
      textFieldRef: inputRef,
      textFieldId: inputId,
      value,
      onValueChange,
      disabled,
      readOnly,
    } = useStrictContext(RootContext);
    const intl = useAxoIntl();

    const handleClear = useCallback(
      (event: MouseEvent) => {
        event.stopPropagation();

        if (disabled || readOnly) {
          event.preventDefault();
          return;
        }

        const input = assert(inputRef.current);
        onValueChange('');
        input.focus();
      },
      [disabled, readOnly, inputRef, onValueChange]
    );

    const invisible = useMemo(() => {
      const isEmpty = value === '';
      return isEmpty && !forceShow;
    }, [value, forceShow]);

    return (
      <button
        type="button"
        aria-label={intl.get('AxoTextField.Clear')}
        aria-controls={inputId}
        className={css(
          Slots.get('trailing'),
          'axo-field-clear',
          invisible && 'axo-field-clear-invisible'
        )}
        onClick={handleClear}
        disabled={disabled || readOnly}
      >
        <span className="axo-field-clear-inner">
          <AxoSymbol.Icon size={16} symbol="x" label={null} />
        </span>
      </button>
    );
  });

  Clear.displayName = 'AxoBaseField.Clear';

  /**
   * <AxoBaseField.BaseAction>
   * --------------------------------------------------------------------------
   */

  /** @internal */
  type BaseActionProps = Readonly<{
    /** Ref to the underlying button element. */
    ref?: Ref<HTMLButtonElement>;
    /** Placement of the action button, either 'leading' or 'trailing' (default). */
    slot?: Slot;
    /** Accessible label for the button describing the action to be taken, not the icon. */
    label: string;
    /** Called when the button is clicked. */
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    /** Overrides the `disabled` state from `Root` for this button only. */
    disabled?: boolean;
    /** When set, the button behaves as a toggle with `aria-pressed` semantics. */
    pressed?: boolean;
    /** The content to be rendered inside the action button, typically an icon. */
    children: ReactNode;
  }>;

  /** @internal */
  const BaseAction: FC<BaseActionProps> = memo(props => {
    const {
      ref,
      slot = 'trailing',
      label,
      onClick,
      disabled: propsDisabled,
      pressed,
      children,
      ...rest
    } = props;
    const { disabled: contextDisabled } = useStrictContext(RootContext);

    const disabled = propsDisabled ?? contextDisabled;

    const handleClick = useCallback(
      (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      },
      [disabled, onClick]
    );

    return (
      <button
        ref={ref}
        className={css(Slots.get(slot), 'axo-field-action')}
        type="button"
        aria-label={label}
        aria-disabled={disabled}
        aria-pressed={pressed}
        onClick={handleClick}
        {...forwardExtraPropsForRadix(rest)}
      >
        <span className="axo-field-action-inner">{children}</span>
      </button>
    );
  });

  BaseAction.displayName = 'AxoBaseField.BaseAction';

  /**
   * <AxoBaseField.Action>
   * --------------------------------------------------------------------------
   */

  export type ActionProps = Omit<BaseActionProps, 'children'> &
    Readonly<{
      /** Icon to display inside the button. */
      symbol: AxoSymbol.Name;
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
    const { symbol, ...rest } = props;
    return (
      <BaseAction {...rest}>
        <AxoSymbol.Icon size={18} symbol={symbol} label={null} />
      </BaseAction>
    );
  });

  Action.displayName = 'AxoBaseField.Action';

  /**
   * <AxoBaseField.Separator>
   * --------------------------------------------------------------------------
   */

  export const Separator: FC = memo(() => {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className="axo-field-separator"
      />
    );
  });

  Separator.displayName = 'AxoBaseField.Separator';

  /**
   * <AxoBaseField.LoadingIndicator>
   * --------------------------------------------------------------------------
   */

  export type LoadingIndicatorProps = Readonly<{
    pending: boolean;
  }>;

  export const LoadingIndicator: FC<LoadingIndicatorProps> = memo(props => {
    return (
      <span
        className={css(
          Slots.get('trailing'),
          'axo-field-loading',
          !props.pending && 'axo-field-loading-invisible'
        )}
      >
        {props.pending && <AxoLoadingIndicator.Root size="sm" />}
      </span>
    );
  });

  LoadingIndicator.displayName = 'AxoBaseField.LoadingIndicator';

  /**
   * <AxoBaseField.ValidationError>
   * --------------------------------------------------------------------------
   */

  export type ValidationErrorProps = Readonly<{
    children: ReactNode;
  }>;

  export const ValidationError: FC<ValidationErrorProps> = memo(props => {
    return <div className="axo-field-error">{props.children}</div>;
  });

  ValidationError.displayName = 'AxoBaseField.ValidationError';

  /**
   * <AxoBaseField.CustomLeadingSlot>
   * --------------------------------------------------------------------------
   */

  export type CustomLeadingSlotProps = Readonly<{
    children: ReactNode;
  }>;

  export const CustomLeadingSlot: FC<CustomLeadingSlotProps> = memo(props => {
    return (
      <div
        className={css(Slots.get('leading'), 'axo-field-custom-leading-slot')}
      >
        {props.children}
      </div>
    );
  });

  CustomLeadingSlot.displayName = 'AxoBaseField.CustomLeadingSlot';

  /**
   * <AxoBaseField.CustomTrailingSlot>
   * --------------------------------------------------------------------------
   */

  export type CustomTrailingSlotProps = Readonly<{
    children: ReactNode;
  }>;

  export const CustomTrailingSlot: FC<CustomTrailingSlotProps> = memo(props => {
    return (
      <div
        className={css(Slots.get('trailing'), 'axo-field-custom-trailing-slot')}
      >
        {props.children}
      </div>
    );
  });

  CustomTrailingSlot.displayName = 'AxoBaseField.CustomTrailingSlot';

  /**
   * <AxoBaseField.CustomAction>
   * --------------------------------------------------------------------------
   */

  export type CustomActionProps = BaseActionProps;

  export const CustomAction: FC<CustomActionProps> = memo(props => {
    return <BaseAction {...props} />;
  });

  CustomAction.displayName = 'AxoBaseField.CustomAction';
}
