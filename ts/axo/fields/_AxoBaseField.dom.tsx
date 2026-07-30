// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useCallback, useId, useMemo, useRef } from 'react';
import type { FC, InputEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { mergeRefs } from '@react-aria/utils';
import { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { tw } from '../tw.dom.tsx';
import { assert } from '../_internal/assert.std.tsx';
import { utf8 } from '../_internal/utf8.std.ts';
import {
  createStrictContext,
  useStrictContext,
  useStrictContextNullable,
} from '../_internal/StrictContext.dom.tsx';
import { useAxoIntl } from '../_internal/AxoIntl.dom.tsx';
import { variants } from '../_internal/variants.dom.tsx';

export namespace AxoBaseField {
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
   * Note: Only include `inputMode`'s relevant to text inputs.
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
   * Toggle whether inputted text is automatically captialized, and if so, in what manner.
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

  export type KeyboardInputAttrs = Readonly<{
    /** Specifies what type of virtual keyboard to use. */
    inputMode?: InputMode;
    /** Hint for form autofill feature. */
    autoComplete?: AutoComplete;
    /** Toggle auto-correction of spelling and punctuation errors. */
    autoCorrect?: AutoCorrect;
    /** Toggle whether inputted text is automatically captialized, and if so, in what manner. */
    autoCapitalize?: AutoCapitalize;
    /** Define what action label (or icon) to present for the enter key on virtual keyboards. */
    enterKeyHint?: EnterKeyHint;
    /** Enables or disables browser spell checking. */
    spellCheck?: boolean;
  }>;

  export type TextValidationInputAttrs = Readonly<{
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
    /** Disables all inputs and actions within the field. */
    disabled?: boolean;
    /** Makes all inputs within the field read-only. */
    readOnly?: boolean;
    /** Should be `Segment`, `Action`, and/or `Separator` elements. */
    children: ReactNode;
  }>;

  export const Group: FC<GroupProps> = memo(props => {
    const { disabled, readOnly } = props;

    const context = useMemo((): GroupContextType => {
      return { disabled, readOnly };
    }, [disabled, readOnly]);

    return (
      <GroupContext.Provider value={context}>
        {props.children}
      </GroupContext.Provider>
    );
  });

  Group.displayName = 'AxoBaseField.Group';

  /**
   * <AxoBaseField.Container>
   * --------------------------------------------------------------------------
   */

  /**
   * Visual style of the field.
   */
  export type Variant = 'text' | 'search';

  const ContainerVariants = variants<Variant>('AxoBaseField.Variant', {
    text: tw(
      'curved-lg bg-control',
      'border-[0.5px] border-primary',
      'shadow-elevation-0 shadow-no-outline'
    ),
    search: tw('rounded-full bg-primary'),
  });

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

  export const ContainerWidths = variants<Width>('AxoBaseField.Width', {
    xs: tw('w-[calc-size(fit-content,min(max(200px,size),100%))]'),
    sm: tw('w-[calc-size(fit-content,min(max(300px,size),100%))]'),
    md: tw('w-[calc-size(fit-content,min(max(400px,size),100%))]'),
    lg: tw('w-[calc-size(fit-content,min(max(500px,size),100%))]'),
    xl: tw('w-[calc-size(fit-content,min(max(600px,size),100%))]'),
    full: tw('w-full'),
  });

  type ContainerContextType = Readonly<{
    variant: Variant;
  }>;

  const ContainerContext = createStrictContext<ContainerContextType>(
    'AxoBaseField.Container'
  );

  export type ContainerProps = Readonly<{
    /** Visual style of the field. */
    variant: Variant;
    /** Controls the width of the entire field. Defaults to `full`. */
    width?: Width;
    /** Should be `Group`, `Icon`, `Segment`, `Separator`, and/or `Action` elements. */
    children: ReactNode;
  }>;

  export const Container: FC<ContainerProps> = memo(props => {
    const { variant } = props;
    const width = props.width ?? 'full';

    const context = useMemo((): ContainerContextType => {
      return { variant };
    }, [variant]);

    return (
      <ContainerContext value={context}>
        <div
          role="group"
          className={tw(
            'group flex items-stretch',
            'overflow-hidden',
            ContainerWidths.get(width),
            ContainerVariants.get(props.variant),
            'placeholder:text-placeholder',
            'not-forced-colors:has-[input:focus]:axo-focus-ring',
            'forced-colors:border-[ButtonBorder] forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]'
          )}
        >
          {props.children}
        </div>
      </ContainerContext>
    );
  });

  Container.displayName = 'AxoBaseField.Container';

  /**
   * <AxoBaseField.Icon>
   * --------------------------------------------------------------------------
   */

  export type IconProps = Readonly<{
    symbol: AxoSymbol.IconName;
  }>;

  export const Icon: FC<IconProps> = memo(props => {
    return (
      <span
        className={tw(
          'pointer-events-none z-10 flex items-center justify-center text-secondary',
          'px-1 first:ps-2.5 last:pe-2.5'
        )}
      >
        <AxoSymbol.Icon size={16} symbol={props.symbol} label={null} />
      </span>
    );
  });

  Icon.displayName = 'AxoBaseField.Icon';

  /**
   * <AxoBaseField.InputProvider>
   * --------------------------------------------------------------------------
   */

  type SegmentContextType = Readonly<{
    ref: RefObject<HTMLInputElement | null>;
    id: string;
    value: string;
    onValueChange: (value: string) => void;
    maxGraphemes: number;
    maxBytes: number;
    disabled: boolean;
    readOnly: boolean;
  }>;

  const SegmentContext = createStrictContext<SegmentContextType>(
    'AxoBaseField.Segment'
  );

  export type SegmentProps = Readonly<{
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
    /** Should be `Input` and `Clear` elements */
    children?: ReactNode;
  }>;

  export const Segment: FC<SegmentProps> = memo(props => {
    const { value, onValueChange, maxGraphemes, maxBytes } = props;
    const groupContext = useStrictContextNullable(GroupContext);

    const disabled = groupContext?.disabled === true || props.disabled === true;
    const readOnly = groupContext?.readOnly === true || props.readOnly === true;

    const ref = useRef<HTMLInputElement>(null);
    const fallbackId = useId();
    const id = props.id ?? fallbackId;

    const inputContext = useMemo((): SegmentContextType => {
      return {
        ref,
        id,
        value,
        onValueChange,
        maxGraphemes,
        maxBytes,
        disabled,
        readOnly,
      };
    }, [
      ref,
      id,
      value,
      onValueChange,
      maxGraphemes,
      maxBytes,
      disabled,
      readOnly,
    ]);

    return (
      <SegmentContext value={inputContext}>{props.children}</SegmentContext>
    );
  });

  Segment.displayName = 'AxoBaseField.Segment';

  /**
   * <AxoBaseField.Input>
   * --------------------------------------------------------------------------
   */

  /**
   * How an `Input` sizes itself within the field group.
   * - `fixed`: Takes up all remaining space (default).
   * - `grow`: Expands with typed content, up to available space.
   * - `fit`: Shrinks to fit typed content, useful for segmented fields.
   */
  export type InputSizing = 'fixed' | 'grow' | 'fit';

  export type InputProps = Readonly<
    {
      /** Ref to the underlying `<input>` element. */
      ref?: RefObject<HTMLInputElement | null>;
      /** The type of the input */
      type: Type;
      /** Form field name for native form submissions. */
      name?: string;
      /** Placeholder text shown when the input is empty. */
      placeholder: string;
      /** How the input sizes itself within the field group. Defaults to `fixed`. */
      sizing?: InputSizing;
      /** Marks the input as required for form validation. */
      required?: boolean;
      /** Focuses the input on mount. */
      autoFocus?: boolean;
    } & KeyboardInputAttrs &
      TextValidationInputAttrs &
      NumberValidationInputAttrs
  >;

  /** The text input field. Must be placed inside `Root`. */
  export const Input: FC<InputProps> = memo(props => {
    const segmentContext = useStrictContext(SegmentContext);
    const sizing = props.sizing ?? 'fixed';
    const mergedRef = mergeRefs(segmentContext.ref, props.ref);

    const { maxGraphemes, maxBytes, onValueChange } = segmentContext;

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
      [maxGraphemes, maxBytes]
    );

    const handleInput = useCallback(
      (event: InputEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const current = input.value;

        const truncated = utf8.truncateBytesAndGraphemes(
          current,
          maxBytes,
          maxGraphemes
        );

        onValueChange(truncated);
      },
      [maxGraphemes, maxBytes, onValueChange]
    );

    return (
      <div
        className={tw(
          'peer z-0 flex min-w-0 first:ps-2.5 last:pe-2.5',
          sizing !== 'fit' && 'grow',
          // prevent overlapping text-selection
          'peer-has-[input]:overflow-hidden'
        )}
      >
        {/* FIXME */}
        {/* oxlint-disable-next-line jsx-a11y/control-has-associated-label */}
        <input
          ref={mergedRef}
          id={segmentContext.id}
          type={props.type}
          value={segmentContext.value}
          placeholder={props.placeholder}
          required={props.required}
          disabled={segmentContext.disabled}
          readOnly={segmentContext.readOnly}
          onInput={handleInput}
          onBeforeInput={handleBeforeInput}
          autoFocus={props.autoFocus}
          className={tw(
            'min-w-0 grow',
            sizing === 'grow' && 'field-sizing-content',
            sizing === 'fit' && 'field-sizing-content shrink',

            // allow text selection in full box
            '-ms-20 ps-20',
            '-mx-20 pe-20',

            'py-1.5',
            'indent-1',
            'text-primary',
            'not-forced-colors:outline-none',
            'disabled:text-disabled',

            '[&::-webkit-search-cancel-button]:appearance-none'
          )}
          // KeyboardInputAttrs
          inputMode={props.inputMode}
          autoComplete={props.autoComplete}
          autoCorrect={props.autoCorrect}
          autoCapitalize={props.autoCapitalize}
          enterKeyHint={props.enterKeyHint}
          spellCheck={props.spellCheck}
          // TextValidationInputAttrs
          minLength={props.minLength}
          maxLength={props.maxLength}
          pattern={props.pattern}
          size={props.size}
          // NumberValidationInputAttrs
          min={props.min}
          max={props.max}
          step={props.step}
        />
      </div>
    );
  });

  Input.displayName = 'AxoBaseField.Input';

  /**
   * <AxoBaseField.RemainingCount>
   * --------------------------------------------------------------------------
   */

  const SHOW_REMAINING_COUNT_THRESHOLD = 0.5;
  const WARN_REMAINING_COUNT_THRESHOLD = 0.25;

  export type RemainingCountProps = Readonly<{
    maxGraphemes: number;
    maxBytes: number;
  }>;

  export const RemainingCount: FC<RemainingCountProps> = memo(props => {
    const { maxBytes, maxGraphemes } = props;
    const segmentContext = useStrictContext(SegmentContext);
    const { value } = segmentContext;

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
          warnRemainingCount ? 'text-destructive' : 'text-secondary'
        )}
      >
        {remainingCount}
      </span>
    );
  });

  RemainingCount.displayName = 'AxoBaseField.RemainingCount';

  /**
   * <AxoBaseField.Clear>
   * --------------------------------------------------------------------------
   */

  const ClearVariants = variants<Variant>('AxoBaseField.Variant', {
    text: tw('group-enabled/clear:group-hover/clear:bg-surface-secondary'),
    search: tw('group-enabled/clear:group-hover/clear:bg-primary'),
  });

  export const Clear: FC = memo(() => {
    const segmentContext = useStrictContext(SegmentContext);
    const containerContext = useStrictContext(ContainerContext);
    const { ref, value, onValueChange } = segmentContext;
    const intl = useAxoIntl();

    const handleClear = useCallback(
      (event: MouseEvent) => {
        event.stopPropagation();
        onValueChange('');
        assert(ref.current).focus();
      },
      [ref, onValueChange]
    );

    if (value === '') {
      return null;
    }

    return (
      <button
        type="button"
        aria-label={intl.get('AxoTextField.Clear')}
        aria-controls={segmentContext.id}
        className={tw(
          'z-10',
          'px-0.5 first:ps-1.5 last:pe-1.5',
          'group/clear group-has-[input:placeholder-shown]:hidden',
          'outline-none'
        )}
        onClick={handleClear}
        disabled={segmentContext.disabled}
      >
        <span
          className={tw(
            'flex items-center justify-center',
            'p-0.5',
            'rounded-full',
            'text-secondary',
            'group-enabled/clear:group-hover/clear:text-primary',
            ClearVariants.get(containerContext.variant),
            'group-focus-visible/clear:axo-focus-ring'
          )}
        >
          <AxoSymbol.Icon size={16} symbol="x" label={null} />
        </span>
      </button>
    );
  });

  Clear.displayName = 'AxoBaseField.Clear';

  /**
   * <AxoBaseField.Action>
   * --------------------------------------------------------------------------
   */

  const ActionVariants = variants<Variant>('AxoBaseField.Variant', {
    text: tw(
      'group-not-aria-disabled/action:group-hover/action:bg-surface-secondary'
    ),
    search: tw('group-not-aria-disabled/action:group-hover/action:bg-primary'),
  });

  export type ActionProps = Readonly<{
    /** Accessible label for the button describing the action to be taken, not the icon. */
    label: string;
    /** Icon to display inside the button. */
    symbol: AxoSymbol.IconName;
    /** Called when the button is clicked. */
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    /** Overrides the `disabled` state from `Root` for this button only. */
    disabled?: boolean;
    /** When set, the button behaves as a toggle with `aria-pressed` semantics. */
    pressed?: boolean;
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
    const groupContext = useStrictContextNullable(GroupContext);
    const containerContext = useStrictContext(ContainerContext);

    const disabled =
      groupContext?.disabled === true ||
      groupContext?.readOnly === true ||
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
        aria-pressed={props.pressed}
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
            'text-secondary',
            'group-not-aria-disabled/action:group-hover/action:text-primary',
            ActionVariants.get(containerContext.variant),
            'group-focus-visible/action:axo-focus-ring'
          )}
        >
          <AxoSymbol.Icon size={18} symbol={props.symbol} label={null} />
        </span>
      </button>
    );
  });

  Action.displayName = 'AxoBaseField.Action';

  /**
   * <AxoBaseField.Separator>
   * --------------------------------------------------------------------------
   */

  export const Separator: FC = memo(() => {
    return (
      <span className={tw('flex py-2 ps-3 pe-2')}>
        <span
          role="separator"
          aria-orientation="vertical"
          className={tw('rounded-xs border-l border-secondary')}
        />
      </span>
    );
  });

  Separator.displayName = 'AxoBaseField.Separator';

  /**
   * <AxoBaseField.Reveal>
   * --------------------------------------------------------------------------
   */

  export type RevealProps = Readonly<{
    label: string;
    revealed: boolean;
    onRevealedChange: (revealed: boolean) => void;
  }>;

  export const Reveal: FC<RevealProps> = memo(props => {
    const { revealed, onRevealedChange } = props;

    const handleClick = useCallback(() => {
      onRevealedChange(!revealed);
    }, [revealed, onRevealedChange]);

    return (
      <Action
        label={props.label}
        symbol={props.revealed ? 'visible-slash' : 'visible'}
        pressed={revealed}
        onClick={handleClick}
      />
    );
  });

  Reveal.displayName = 'AxoBaseField.Reveal';
}
