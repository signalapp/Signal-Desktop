// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FormEvent } from 'react';
import React, { memo, useCallback, useMemo, useRef } from 'react';
import type { Formatter, FormatterToken } from '@signalapp/minimask';
import { useInputMask } from '../../../hooks/useInputMask';
import type { CurrencyFormatResult } from '../../../util/currency';
import { getCurrencyFormat } from '../../../util/currency';

export type DonateInputAmountProps = Readonly<{
  className: string;
  currency: string;
  id: string;
  placeholder?: string;
  value: string;
  onValueChange: (newValue: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
}>;

const getAmountFormatter = (
  currencyFormat: CurrencyFormatResult | undefined
): Formatter => {
  return (input: string) => {
    const { symbolPrefix, symbolSuffix, decimal, group } = currencyFormat ?? {};
    const tokens: Array<FormatterToken> = [];
    let isDecimalPresent = false;
    let isDigitPresent = false;
    let decimalLength = 0;

    if (symbolPrefix) {
      for (const char of symbolPrefix.split('')) {
        tokens.push({ char, index: 0, mask: true });
      }
    }

    for (const [index, char] of input.split('').entries()) {
      if (/[\d., ']/.test(char) || (group && char === group)) {
        if (decimal && char === decimal) {
          // Prevent multiple decimal separators
          if (isDecimalPresent) {
            continue;
          } else {
            isDecimalPresent = true;
            // Force leading 0 for decimal-only values (for parseCurrencyString)
            if (!isDigitPresent) {
              tokens.push({ char: '0', index, mask: false });
            }
          }
        }

        if (!isDigitPresent && /\d/.test(char)) {
          isDigitPresent = true;
        }

        // Prevent over 2 decimal digits due to issues with parsing
        if (isDecimalPresent) {
          if (decimalLength > 2) {
            continue;
          }

          decimalLength += 1;
        }

        tokens.push({ char, index, mask: false });
      }
    }

    if (symbolSuffix) {
      const lastIndex = tokens[tokens.length - 1]?.index ?? 0;
      for (const char of symbolSuffix.split('')) {
        tokens.push({ char, index: lastIndex, mask: true });
      }
    }

    return tokens;
  };
};

export const DonateInputAmount = memo(function DonateInputAmount(
  props: DonateInputAmountProps
) {
  const { currency, onBlur, onFocus, onValueChange, value } = props;

  const inputRef = useRef<HTMLInputElement>(null);

  const currencyFormat = useMemo<CurrencyFormatResult | undefined>(
    () => getCurrencyFormat(currency),
    [currency]
  );

  const amountFormatter = useMemo(
    () => getAmountFormatter(currencyFormat),
    [currencyFormat]
  );
  useInputMask(inputRef, amountFormatter);

  const handleInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      onValueChange(event.currentTarget.value);
    },
    [onValueChange]
  );

  const onFocusWithCurrencyHandler = useCallback(() => {
    // Initialize field with the currency symbol
    if (!value && currencyFormat?.symbol) {
      onValueChange(currencyFormat?.symbol);
    }

    if (typeof onFocus === 'function') {
      onFocus();
    }
  }, [currencyFormat, onFocus, onValueChange, value]);

  const onBlurWithCurrencyHandler = useCallback(() => {
    // If nothing was typed then remove currency symbol to restore placeholder
    if (value === currencyFormat?.symbol) {
      onValueChange('');
    }

    if (typeof onBlur === 'function') {
      onBlur();
    }
  }, [currencyFormat, onBlur, onValueChange, value]);

  return (
    <input
      className={props.className}
      ref={inputRef}
      id={props.id}
      placeholder={props.placeholder}
      type="text"
      inputMode="decimal"
      autoComplete="transaction-amount"
      value={props.value}
      onInput={handleInput}
      onFocus={onFocusWithCurrencyHandler}
      onBlur={onBlurWithCurrencyHandler}
    />
  );
});
