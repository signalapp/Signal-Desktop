// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FormEvent } from 'react';
import React, { memo, useCallback, useRef } from 'react';
import { CC_EXP_FORMATTER, useInputMask } from '../../../hooks/useInputMask';
import { CardExpirationError } from '../../../types/DonationsCardForm';
import { missingCaseError } from '../../../util/missingCaseError';
import type { LocalizerType } from '../../../types/I18N';

export function getCardExpirationErrorMessage(
  i18n: LocalizerType,
  error: CardExpirationError
): string {
  switch (error) {
    case CardExpirationError.EXPIRED_PAST_YEAR:
    case CardExpirationError.EXPIRED_EARLIER_IN_YEAR:
      return i18n('icu:DonateFlow__card-form-error-expiration-expired');
    case CardExpirationError.YEAR_MISSING:
    case CardExpirationError.YEAR_EMPTY:
      return i18n('icu:DonateFlow__card-form-error-year-missing');
    case CardExpirationError.EMPTY:
    case CardExpirationError.INVALID_CHARS:
    case CardExpirationError.TOO_MANY_SLASHES:
    case CardExpirationError.MONTH_EMPTY:
    case CardExpirationError.MONTH_TOO_LONG:
    case CardExpirationError.YEAR_TOO_SHORT:
    case CardExpirationError.YEAR_TOO_LONG:
    case CardExpirationError.MONTH_INVALID_INTEGER:
    case CardExpirationError.YEAR_INVALID_INTEGER:
    case CardExpirationError.MONTH_OUT_OF_RANGE:
    case CardExpirationError.YEAR_TOO_FAR_IN_FUTURE:
      return i18n('icu:DonateFlow__card-form-error-invalid');
    default:
      throw missingCaseError(error);
  }
}

export type DonateInputCardExpProps = Readonly<{
  id: string;
  value: string;
  onValueChange: (newValue: string) => void;
  onBlur?: () => void;
}>;

export const DonateInputCardExp = memo(function DonateInputCardExp(
  props: DonateInputCardExpProps
) {
  const { onValueChange } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  useInputMask(inputRef, CC_EXP_FORMATTER);

  const handleInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      onValueChange(event.currentTarget.value);
    },
    [onValueChange]
  );

  return (
    <input
      ref={inputRef}
      id={props.id}
      placeholder="MM/YY"
      type="text"
      inputMode="numeric"
      autoComplete="cc-exp"
      value={props.value}
      onInput={handleInput}
      onBlur={props.onBlur}
    />
  );
});
