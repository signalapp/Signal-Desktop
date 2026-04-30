// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useCallback, useId, useMemo, useRef } from 'react';
import type { FC, InputEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { mergeRefs } from '@react-aria/utils';
import { AxoSymbol } from './AxoSymbol.dom.tsx';
import { tw } from './tw.dom.tsx';
import type { TailwindStyles } from './tw.dom.tsx';
import { assert } from './_internal/assert.std.tsx';
import { utf8 } from './_internal/utf8.std.ts';
import {
  createStrictContext,
  useStrictContext,
} from './_internal/StrictContext.dom.tsx';

const Namespace = 'AxoTextField';

export namespace AxoTextField {
  export type Width = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  export type Sizing = 'fixed' | 'grow' | 'fit';

  /**
   * <AxoTextField.Root>
   * --------------------------------------------------------------------------
   */

  type RootContextType = Readonly<{
    disabled?: boolean;
    readOnly?: boolean;
  }>;

  const RootContext = createStrictContext<RootContextType>(`${Namespace}.Root`);

  export type RootProps = Readonly<{
    symbol?: AxoSymbol.IconName;
    width?: Width;
    disabled?: boolean;
    readOnly?: boolean;
    children: ReactNode;
  }>;

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

  Root.displayName = `${Namespace}.Root`;

  /**
   * <AxoTextField.Group>
   * --------------------------------------------------------------------------
   */

  const GroupWidthStyles: Record<Width, TailwindStyles> = {
    xs: tw('w-[calc-size(fit-content,min(max(200px,size),100%))]'),
    sm: tw('w-[calc-size(fit-content,min(max(300px,size),100%))]'),
    md: tw('w-[calc-size(fit-content,min(max(400px,size),100%))]'),
    lg: tw('w-[calc-size(fit-content,min(max(500px,size),100%))]'),
    xl: tw('w-[calc-size(fit-content,min(max(600px,size),100%))]'),
    full: tw('w-full'),
  };

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
          GroupWidthStyles[props.width],
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

  Group.displayName = `${Namespace}.Group`;

  /**
   * <AxoTextField.Input>
   * --------------------------------------------------------------------------
   */

  export type InputProps = Readonly<{
    ref?: RefObject<HTMLInputElement | null>;

    id?: string;
    name?: string;
    placeholder: string;

    sizing?: Sizing;

    value: string;
    onValueChange: (value: string) => void;

    maxGraphemes: number;
    maxBytes: number;

    showCount?: boolean;
    showClearWithLabel?: string | null;

    required?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    autoFocus?: boolean;
    spellCheck?: boolean;
  }>;

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
        {props.showClearWithLabel != null && (
          <Clear
            inputRef={inputRef}
            inputId={inputId}
            value={props.value}
            onValueChange={onValueChange}
            label={props.showClearWithLabel}
            disabled={disabled || readOnly}
          />
        )}
      </>
    );
  });

  Input.displayName = `${Namespace}.Input`;

  /**
   * <AxoTextField.Icon>
   * --------------------------------------------------------------------------
   */

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

  Icon.displayName = `${Namespace}.Icon`;

  /**
   * <AxoTextField.Count>
   * --------------------------------------------------------------------------
   */

  const SHOW_REMAINING_COUNT_THRESHOLD = 0.5;
  const WARN_REMAINING_COUNT_THRESHOLD = 0.25;

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

  Count.displayName = `${Namespace}.Count`;

  /**
   * <AxoTextField.Clear>
   * --------------------------------------------------------------------------
   */

  type ClearProps = Readonly<{
    inputRef: RefObject<HTMLInputElement | null>;
    inputId: string;
    label: string;
    value: string;
    onValueChange: (value: string) => void;
    disabled: boolean;
  }>;

  /** @internal */
  const Clear: FC<ClearProps> = memo(props => {
    const { inputRef, value, onValueChange } = props;

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
        aria-label={props.label}
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

  Clear.displayName = `${Namespace}.Clear`;

  /**
   * <AxoTextField.Action>
   * --------------------------------------------------------------------------
   */

  export type ActionProps = Readonly<{
    label: string;
    symbol: AxoSymbol.IconName;
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    disabled?: boolean;
  }>;

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
        if (!disabled) {
          onClick?.(event);
        }
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

  Action.displayName = `${Namespace}.Action`;

  /**
   * <AxoTextField.Separator>
   * --------------------------------------------------------------------------
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

  Separator.displayName = `${Namespace}.Separator`;
}
