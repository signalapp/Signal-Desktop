// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, RefObject } from 'react';
import { memo, useState } from 'react';
import { AxoBaseField } from './_AxoBaseField.dom.tsx';
import { useAxoIntl } from '../_internal/AxoIntl.dom.tsx';

export namespace AxoPasswordField {
  /**
   * <AxoPasswordField.Root>
   * --------------------------------------------------------------------------
   */

  export type AutoComplete = 'current-password' | 'new-password';

  export type RootProps = Readonly<{
    /** Ref to the underlying `<input>` element. */
    ref?: RefObject<HTMLInputElement | null>;
    /** Controls the width of the entire field. Defaults to `full`. */
    width?: AxoBaseField.Width;
    /** Controlled value of the input. */
    value: string;
    /** Called with the new value on every change. */
    onValueChange: (value: string) => void;
    /** Maximum number of Unicode grapheme clusters allowed. */
    maxGraphemes: number;
    /** Maximum number of UTF-8 bytes allowed. Should be ~4x the number of `maxGraphemes`. */
    maxBytes: number;
    /** Placeholder text shown when the input is empty. */
    placeholder: string;
    /** Hint for form autofill feature. */
    autoComplete: AutoComplete;
    /** Focuses the input on mount. */
    autoFocus?: boolean;
    /** Disables this input. */
    disabled?: boolean;
    /** Hide the reveal button. */
    hideReveal?: boolean;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    const intl = useAxoIntl();
    const [revealed, setRevealed] = useState(false);
    return (
      <AxoBaseField.Container variant="text" width={props.width}>
        <AxoBaseField.Segment
          value={props.value}
          onValueChange={props.onValueChange}
          maxGraphemes={props.maxGraphemes}
          maxBytes={props.maxBytes}
          disabled={props.disabled}
        >
          <AxoBaseField.Input
            ref={props.ref}
            type={revealed ? 'text' : 'password'}
            inputMode="text"
            autoComplete={props.autoComplete}
            placeholder={props.placeholder}
            autoFocus={props.autoFocus}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </AxoBaseField.Segment>
        {!props.hideReveal && (
          <AxoBaseField.Reveal
            label={intl.get('AxoPasswordField.Reveal')}
            revealed={revealed}
            onRevealedChange={setRevealed}
          />
        )}
      </AxoBaseField.Container>
    );
  });

  Root.displayName = 'AxoPasswordField.Root';
}
