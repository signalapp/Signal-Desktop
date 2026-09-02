// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FC, ReactNode, RefObject } from 'react';
import { memo } from 'react';
import { AxoList } from './AxoList.dom.tsx';
import { AxoBaseField } from '../fields/_AxoBaseField.dom.tsx';
import type { AxoSymbol } from '../AxoSymbol.dom.tsx';
import { forwardExtraPropsForRadix } from '../_internal/props.dom.tsx';
import { tw } from '../tw.dom.tsx';

export namespace AxoFieldList {
  /**
   * <AxoFieldList.Root>
   * --------------------------------------------------------------------------
   */

  export type RootProps = Readonly<{
    title?: ReactNode;
    description?: ReactNode;
    help?: ReactNode;
    children: ReactNode;
  }>;

  export const Root: FC<RootProps> = memo(props => {
    return (
      <AxoList.Root>
        {props.title != null && (
          <AxoList.Header>
            <AxoList.Label>{props.title}</AxoList.Label>
            {/* We probably don't ever want to show a description without a title */}
            {props.description != null && (
              <AxoList.Description>{props.description}</AxoList.Description>
            )}
          </AxoList.Header>
        )}
        <AxoList.Body>{props.children}</AxoList.Body>
        {props.help != null && (
          <AxoList.Footer>
            <AxoList.FooterDescription>{props.help}</AxoList.FooterDescription>
          </AxoList.Footer>
        )}
      </AxoList.Root>
    );
  });

  Root.displayName = 'AxoFieldList.Root';

  /**
   * <AxoFieldList.Root>
   * --------------------------------------------------------------------------
   */

  export type TextFieldItemProps = Readonly<{
    /** Ref to the underlying `<input>` element. */
    ref?: RefObject<HTMLInputElement | null>;
    /** An icon to show before the field */
    symbol?: AxoSymbol.Name;
    /** Provide your own id for the `<input>` to target with a `<label>`. Auto-generated if omitted. */
    id?: string;
    /** Form field name for native form submissions. */
    name?: string;
    /** Placeholder text shown when the input is empty. */
    placeholder: string;
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

  export const TextFieldItem: FC<TextFieldItemProps> = memo(props => {
    const {
      ref,
      symbol,
      id,
      name,
      placeholder,
      value,
      onValueChange,
      maxGraphemes,
      maxBytes,
      showCount,
      showClear,
      required,
      disabled,
      readOnly,
      autoFocus,
      spellCheck,
      // oxlint-disable-next-line no-unused-vars
      type,
      ...rest
    } = props;

    return (
      <>
        <AxoBaseField.Container variant="listitem" width="full">
          {symbol != null && <AxoBaseField.Icon symbol={symbol} />}
          <AxoBaseField.Segment
            id={id}
            value={value}
            onValueChange={onValueChange}
            disabled={disabled}
            readOnly={readOnly}
            maxBytes={maxBytes}
            maxGraphemes={maxGraphemes}
          >
            <AxoBaseField.Input
              ref={ref}
              type="text"
              name={name}
              required={required}
              placeholder={placeholder}
              autoFocus={autoFocus}
              spellCheck={spellCheck}
              {...forwardExtraPropsForRadix(rest)}
            />
            {showCount && (
              <AxoBaseField.RemainingCount
                maxGraphemes={maxGraphemes}
                maxBytes={maxBytes}
              />
            )}
            {showClear && <AxoBaseField.Clear />}
          </AxoBaseField.Segment>
        </AxoBaseField.Container>
        <div
          className={tw(
            'mx-2 my-[2.5px] border-b border-b-primary last:hidden',
            'forced-colors:border-b-0'
          )}
        />
      </>
    );
  });

  TextFieldItem.displayName = 'AxoFieldList.TextFieldItem';
}
