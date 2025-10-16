// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FormEvent, KeyboardEvent } from 'react';
import React, { memo, useCallback, useRef } from 'react';
import {
  CC_NUMBER_FORMATTER,
  useInputMask,
} from '../../../hooks/useInputMask.dom.js';
import type { LocalizerType } from '../../../types/I18N.std.js';
import { CardNumberError } from '../../../types/DonationsCardForm.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';

export function getCardNumberErrorMessage(
  i18n: LocalizerType,
  error: CardNumberError
): string {
  switch (error) {
    case CardNumberError.EMPTY:
    case CardNumberError.INVALID_CHARS:
    case CardNumberError.INVALID_OR_INCOMPLETE_NUMBER:
    case CardNumberError.INVALID_NUMBER:
      return i18n('icu:DonateFlow__card-form-error-invalid-card-number');
    default:
      throw missingCaseError(error);
  }
}

export type DonateInputCardNumberProps = Readonly<{
  id: string;
  value: string;
  onValueChange: (newValue: string) => void;
  maxInputLength: number;
  onBlur?: () => void;
  onEnter?: () => void;
}>;

export const DonateInputCardNumber = memo(function DonateInputCardNumber(
  props: DonateInputCardNumberProps
) {
  const { onEnter, onValueChange } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  useInputMask(inputRef, CC_NUMBER_FORMATTER);

  const handleInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      onValueChange(event.currentTarget.value);
    },
    [onValueChange]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (onEnter && event.key === 'Enter') {
        onEnter();
      }
    },
    [onEnter]
  );

  return (
    <input
      ref={inputRef}
      id={props.id}
      placeholder="0000 0000 0000 0000"
      type="text"
      inputMode="numeric"
      autoComplete="cc-number"
      maxLength={props.maxInputLength}
      value={props.value}
      onInput={handleInput}
      onBlur={props.onBlur}
      onKeyDown={handleKeyDown}
    />
  );
});
