// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode, RefObject } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import { AxoBaseField } from './_AxoBaseField.dom.tsx';
import { useAxoIntl } from '../_internal/AxoIntl.dom.tsx';
import {
  createStrictContext,
  useStrictContext,
} from '../_internal/StrictContext.dom.tsx';

/**
 * @example Anatomy
 * ```tsx
 * <AxoPasswordField.Root>
 *   <AxoPasswordField.Input />
 *   <AxoPasswordField.Reveal />
 * </AxoPasswordField.Root/>
 * ```
 */
export namespace AxoPasswordField {
  type ContextType = Readonly<{
    revealed: boolean;
    onRevealedChange: (revealed: boolean) => void;
  }>;

  const Context = createStrictContext<ContextType>('AxoPasswordField.Root');

  /**
   * <AxoPasswordField.Root>
   * --------------------------------------------------------------------------
   */

  export type AutoComplete = 'current-password' | 'new-password';

  export type RootProps = Readonly<{
    /** Controlled value of the input. */
    value: string;
    /** Called with the new value on every change. */
    onValueChange: (value: string) => void;
    /** Maximum number of Unicode grapheme clusters allowed. */
    maxGraphemes: number;
    /** Maximum number of UTF-8 bytes allowed. Should be ~4x the number of `maxGraphemes`. */
    maxBytes: number;
    /** Disables this input. */
    disabled?: boolean;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const [revealed, setRevealed] = useState(false);

    const context = useMemo((): ContextType => {
      return {
        revealed,
        onRevealedChange: setRevealed,
      };
    }, [revealed]);

    return (
      <Context value={context}>
        <AxoBaseField.Root
          variant="text"
          value={props.value}
          onValueChange={props.onValueChange}
          maxGraphemes={props.maxGraphemes}
          maxBytes={props.maxBytes}
          disabled={props.disabled}
        >
          {props.children}
        </AxoBaseField.Root>
      </Context>
    );
  });

  Root.displayName = 'AxoPasswordField.Root';

  /**
   * <AxoPasswordField.Input>
   * --------------------------------------------------------------------------
   */

  export type InputProps = Readonly<{
    /** Ref to the underlying `<input>` element. */
    ref?: RefObject<HTMLInputElement | null>;
    /** Placeholder text shown when the input is empty. */
    placeholder: string;
    /** Hint for form autofill feature. */
    autoComplete: AutoComplete;
    /** Focuses the input on mount. */
    autoFocus?: boolean;
  }>;

  export const Input: FC<InputProps> = memo(props => {
    const { ref, autoComplete, placeholder, autoFocus } = props;
    const { revealed } = useStrictContext(Context);

    return (
      <AxoBaseField.Input
        ref={ref}
        type={revealed ? 'text' : 'password'}
        inputMode="text"
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    );
  });

  Input.displayName = 'AxoPasswordField.Input';

  /**
   * <AxoPasswordField.Reveal>
   * --------------------------------------------------------------------------
   */

  export const Reveal: FC = memo(() => {
    const intl = useAxoIntl();
    const { revealed, onRevealedChange } = useStrictContext(Context);

    const handleClick = useCallback(() => {
      onRevealedChange(!revealed);
    }, [revealed, onRevealedChange]);

    return (
      <AxoBaseField.Action
        label={intl.get('AxoPasswordField.Reveal')}
        symbol={revealed ? 'visible-slash' : 'visible'}
        pressed={revealed}
        onClick={handleClick}
      />
    );
  });

  Reveal.displayName = 'AxoPasswordField.Reveal';
}
