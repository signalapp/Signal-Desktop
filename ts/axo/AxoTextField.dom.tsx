// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useCallback, useId, useMemo, useRef } from 'react';
import type { FC, InputEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { mergeRefs } from '@react-aria/utils';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import { assert } from './_internal/assert.std.tsx';
import { utf8 } from './_internal/utf8.std.ts';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.tsx';
import { useAxoIntl } from './_internal/AxoIntl.dom.tsx';
import { variants } from './_internal/variants.dom.tsx';

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

  /** @internal */
  type RootContextType = Readonly<{
    disabled?: boolean;
    readOnly?: boolean;
  }>;

  /** @internal */
  const RootContext = createStrictContext<RootContextType>('AxoTextField.Root');

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
  export type Width = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

  export type RootProps = Readonly<{
    /** Leading icon displayed before the input. */
    symbol?: AxoSymbol.IconName;
    /** Controls the width of the entire field. Defaults to `full`. */
    width?: Width;
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
    const { disabled, readOnly } = props;

    const context = useMemo((): RootContextType => {
      return { disabled, readOnly };
    }, [disabled, readOnly]);

    return (
      <RootContext.Provider value={context}>
        <Group width={props.width ?? 'full'}>
          {props.symbol != null && <Icon symbol={props.symbol} />}
          {props.children}
        </Group>
      </RootContext.Provider>
    );
  });

  Root.displayName = 'AxoTextField.Root';

  /**
   * <AxoTextField.Group>
   * --------------------------------------------------------------------------
   */

  const GroupWidthStyles = variants<Width>('AxoTextField.Width', {
    xs: tw('w-[calc-size(fit-content,min(max(200px,size),100%))]'),
    sm: tw('w-[calc-size(fit-content,min(max(300px,size),100%))]'),
    md: tw('w-[calc-size(fit-content,min(max(400px,size),100%))]'),
    lg: tw('w-[calc-size(fit-content,min(max(500px,size),100%))]'),
    xl: tw('w-[calc-size(fit-content,min(max(600px,size),100%))]'),
    full: tw('w-full'),
  });

  /** @internal */
  type GroupProps = Readonly<{
    width: Width;
    children: ReactNode;
  }>;

  /** @internal */
  const Group: FC<GroupProps> = memo(props => {
    return (
      <div
        role="group"
        className={tw(
          'group flex items-stretch',
          'overflow-hidden',
          GroupWidthStyles.get(props.width),
          'curved-lg bg-fill-primary',
          'border-[0.5px] border-border-primary',
          'shadow-elevation-0 shadow-no-outline',
          'placeholder:text-label-placeholder',
          'select-none',
          '-outline-offset-[1.5px]',
          'not-forced-colors:has-[input:focus]:outline-[1.5px]',
          'not-forced-colors:has-[input:focus]:outline-border-selected',
          'forced-colors:border-[ButtonBorder] forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]',
          'not-forced-colors:has-[input:user-invalid]:outline-border-error',
          'not-forced-colors:has-[input:user-invalid]:outline-[1.4px]'
        )}
      >
        {props.children}
      </div>
    );
  });

  Group.displayName = 'AxoTextField.Group';

  /**
   * <AxoTextField.Input>
   * --------------------------------------------------------------------------
   */

  /**
   * How an `Input` sizes itself within the field group.
   * - `fixed`: Takes up all remaining space (default).
   * - `grow`: Expands with typed content, up to available space.
   * - `fit`: Shrinks to fit typed content, useful for segmented fields.
   */
  export type Sizing = 'fixed' | 'grow' | 'fit';

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
    sizing?: Sizing;
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
  }>;

  /** The text input field. Must be placed inside `Root`. */
  export const Input: FC<InputProps> = memo(props => {
    const { onValueChange, maxBytes, maxGraphemes } = props;
    const context = useStrictContext(RootContext);

    const disabled = context.disabled === true || props.disabled === true;
    const readOnly = context.readOnly === true || props.readOnly === true;

    const sizing = props.sizing ?? 'fixed';
    const inputRef = useRef<HTMLInputElement>(null);

    const mergedRef = mergeRefs(inputRef, props.ref);

    const fallbackId = useId();
    const inputId = props.id ?? fallbackId;

    const handleBeforeInput = useCallback(
      (event: InputEvent<HTMLInputElement>) => {
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
        input.maxLength = result.length;
        requestAnimationFrame(() => {
          input.removeAttribute('maxlength'); // reset
        });
      },
      [maxBytes, maxGraphemes]
    );

    const handleInput = useCallback(
      (event: InputEvent<HTMLInputElement>) => {
        onValueChange(
          utf8.truncateBytesAndGraphemes(
            event.currentTarget.value,
            maxBytes,
            maxGraphemes
          )
        );
      },
      [onValueChange, maxBytes, maxGraphemes]
    );

    return (
      <>
        <div
          className={tw(
            'peer z-0 flex min-w-0 first:ps-2.5 last:pe-2.5',
            sizing !== 'fit' && 'grow',
            // prevent overlapping text-selection
            'peer-has-[input]:overflow-hidden'
          )}
        >
          <input
            ref={mergedRef}
            id={inputId}
            type="text"
            value={props.value}
            placeholder={props.placeholder ?? ''}
            required={props.required}
            disabled={disabled}
            readOnly={readOnly}
            onInput={handleInput}
            onBeforeInput={handleBeforeInput}
            autoFocus={props.autoFocus}
            spellCheck={props.spellCheck}
            className={tw(
              'min-w-0 grow',
              sizing === 'grow' && 'field-sizing-content',
              sizing === 'fit' && 'field-sizing-content shrink',

              // allow text selection in full box
              '-ms-20 ps-20',
              '-mx-20 pe-20',

              'py-1.5',
              'indent-1',
              'text-label-primary',
              'not-forced-colors:outline-none',
              'disabled:text-label-disabled'
            )}
          />
        </div>
        {props.showCount && (
          <Count
            value={props.value}
            maxBytes={props.maxBytes}
            maxGraphemes={props.maxGraphemes}
          />
        )}
        {props.showClear && (
          <Clear
            inputRef={inputRef}
            inputId={inputId}
            value={props.value}
            onValueChange={onValueChange}
            disabled={disabled || readOnly}
          />
        )}
      </>
    );
  });

  Input.displayName = 'AxoTextField.Input';

  /**
   * <AxoTextField.Icon>
   * --------------------------------------------------------------------------
   */

  /** @internal */
  type IconProps = Readonly<{
    symbol: AxoSymbol.IconName;
  }>;

  /** @internal */
  const Icon: FC<IconProps> = memo(props => {
    return (
      <span
        className={tw(
          'pointer-events-none z-10 flex items-center justify-center text-label-secondary',
          'px-1 first:ps-2.5 last:pe-2.5'
        )}
      >
        <AxoSymbol.Icon size={16} symbol={props.symbol} label={null} />
      </span>
    );
  });

  Icon.displayName = 'AxoTextField.Icon';

  /**
   * <AxoTextField.Count>
   * --------------------------------------------------------------------------
   */

  const SHOW_REMAINING_COUNT_THRESHOLD = 0.5;
  const WARN_REMAINING_COUNT_THRESHOLD = 0.25;

  /** @internal */
  type CountProps = Readonly<{
    value: string;
    maxBytes: number;
    maxGraphemes: number;
  }>;

  /** @internal */
  const Count: FC<CountProps> = memo(props => {
    const { value, maxBytes, maxGraphemes } = props;

    const remainingCount = useMemo(() => {
      if (value.length === 0) {
        return maxGraphemes;
      }

      const totalBytes = utf8.getByteLength(value);
      const totalGraphemes = utf8.getGraphemeCount(value);

      const remainingBytes = maxBytes - totalBytes;
      const remainingChars = maxGraphemes - totalGraphemes;

      if (remainingBytes > remainingChars) {
        return remainingChars;
      }

      return remainingBytes;
    }, [value, maxBytes, maxGraphemes]);

    const showRemainingCount = useMemo(() => {
      return remainingCount <= maxGraphemes * SHOW_REMAINING_COUNT_THRESHOLD;
    }, [maxGraphemes, remainingCount]);

    const warnRemainingCount = useMemo(() => {
      return remainingCount <= maxGraphemes * WARN_REMAINING_COUNT_THRESHOLD;
    }, [maxGraphemes, remainingCount]);

    if (!showRemainingCount) {
      return null;
    }

    return (
      <span
        className={tw(
          'pointer-events-none z-10 flex items-center',
          'px-1 first:ps-2.5 last:pe-2.5',
          'type-body-small tabular-nums',
          warnRemainingCount
            ? 'text-color-label-destructive'
            : 'text-label-secondary'
        )}
      >
        {remainingCount}
      </span>
    );
  });

  Count.displayName = 'AxoTextField.Count';

  /**
   * <AxoTextField.Clear>
   * --------------------------------------------------------------------------
   */

  /** @internal */
  type ClearProps = Readonly<{
    inputRef: RefObject<HTMLInputElement | null>;
    inputId: string;
    value: string;
    onValueChange: (value: string) => void;
    disabled: boolean;
  }>;

  /** @internal */
  const Clear: FC<ClearProps> = memo(props => {
    const { inputRef, value, onValueChange } = props;
    const intl = useAxoIntl();

    const handleClear = useCallback(
      (event: MouseEvent) => {
        event.stopPropagation();
        onValueChange('');
        assert(inputRef.current).focus();
      },
      [inputRef, onValueChange]
    );

    if (value === '') {
      return null;
    }

    return (
      <button
        type="button"
        aria-label={intl.get('AxoTextField.Clear')}
        aria-controls={props.inputId}
        className={tw(
          'z-10',
          'px-0.5 first:ps-1.5 last:pe-1.5',
          'group/clear group-has-[input:placeholder-shown]:hidden',
          'outline-none'
        )}
        onClick={handleClear}
        disabled={props.disabled}
      >
        <span
          className={tw(
            'flex items-center justify-center',
            'p-0.5',
            'rounded-full',
            'text-label-secondary',
            'group-enabled/clear:group-hover/clear:text-label-primary',
            'group-enabled/clear:group-hover/clear:bg-background-secondary',
            'group-focus-visible/clear:outline-focus-ring'
          )}
        >
          <AxoSymbol.Icon size={16} symbol="x" label={null} />
        </span>
      </button>
    );
  });

  Clear.displayName = 'AxoTextField.Clear';

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
    const { onClick } = props;
    const context = useStrictContext(RootContext);

    const disabled =
      context.disabled === true ||
      context.readOnly === true ||
      props.disabled === true;

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
        type="button"
        aria-label={props.label}
        aria-disabled={disabled}
        className={tw(
          'group/action z-10 outline-none',
          'first:ps-1 last:pe-1',
          'aria-disabled:cursor-default'
        )}
        onClick={handleClick}
      >
        <span
          className={tw(
            'flex items-center justify-center rounded-full p-1',
            'text-label-secondary',
            'group-not-aria-disabled/action:group-hover/action:text-label-primary',
            'group-not-aria-disabled/action:group-hover/action:bg-background-secondary',
            'group-focus-visible/action:outline-focus-ring'
          )}
        >
          <AxoSymbol.Icon size={18} symbol={props.symbol} label={null} />
        </span>
      </button>
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
    return (
      <span className={tw('flex py-2 ps-3 pe-2')}>
        <span
          role="separator"
          aria-orientation="vertical"
          className={tw(
            'w-px rounded-xs',
            // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
            'bg-[#000]/12 dark:bg-[#FFF]/20' // should be "separator"
          )}
        />
      </span>
    );
  });

  Separator.displayName = 'AxoTextField.Separator';
}
