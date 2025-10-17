// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FormEvent, KeyboardEvent } from 'react';
import React, { memo, useCallback, useRef } from 'react';
import {
  CC_CVC_FORMATTER,
  useInputMask,
} from '../../../hooks/useInputMask.dom.js';
import type { LocalizerType } from '../../../types/I18N.std.js';
import { CardCvcError } from '../../../types/DonationsCardForm.std.js';
import { missingCaseError } from '../../../util/missingCaseError.std.js';

export function getCardCvcErrorMessage(
  i18n: LocalizerType,
  error: CardCvcError
): string {
  switch (error) {
    case CardCvcError.LENGTH_TOO_SHORT:
      return i18n('icu:DonateFlow__card-form-error-cvc-too-short');
    case CardCvcError.EMPTY:
    case CardCvcError.INVALID_CHARS:
    case CardCvcError.LENGTH_TOO_LONG:
    case CardCvcError.LENGTH_INVALID:
      return i18n('icu:DonateFlow__card-form-error-invalid');
    default:
      throw missingCaseError(error);
  }
}

export type DonateInputCardCvcProps = Readonly<{
  id: string;
  value: string;
  onValueChange: (newValue: string) => void;
  maxInputLength: number;
  onBlur?: () => void;
  onEnter?: () => void;
}>;

export const DonateInputCardCvc = memo(function DonateInputCardCvc(
  props: DonateInputCardCvcProps
) {
  const { onEnter, onValueChange } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  useInputMask(inputRef, CC_CVC_FORMATTER);

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
      placeholder="123"
      type="text"
      inputMode="numeric"
      autoComplete="cc-csc"
      maxLength={props.maxInputLength}
      value={props.value}
      onInput={handleInput}
      onBlur={props.onBlur}
      onKeyDown={handleKeyDown}
    />
  );
});
