// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FormEvent } from 'react';
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Formatter, FormatterToken } from '@signalapp/minimask';
import { useInputMask } from '../../../hooks/useInputMask.dom.js';
import type { CurrencyFormatResult } from '../../../util/currency.dom.js';
import {
  getCurrencyFormat,
  ZERO_DECIMAL_CURRENCIES,
} from '../../../util/currency.dom.js';

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

const AMOUNT_MAX_DIGITS_STRIPE = 8;

const getAmountFormatter = (
  currencyFormat: CurrencyFormatResult | undefined
): Formatter => {
  return (input: string) => {
    const { currency, decimal, group, symbolPrefix, symbolSuffix } =
      currencyFormat ?? {};
    const isZeroDecimal = Boolean(
      currency && ZERO_DECIMAL_CURRENCIES.has(currency)
    );
    const tokens: Array<FormatterToken> = [];
    let isDecimalPresent = false;
    let firstDigitWasZero = false;
    let digitCount = 0;
    let decimalLength = 0;

    if (symbolPrefix) {
      for (const char of symbolPrefix.split('')) {
        tokens.push({ char, index: 0, mask: true });
      }
    }

    for (const [index, char] of input.split('').entries()) {
      const isCharDigit = /\d/.test(char);
      const isCharGroup = group && char === group;
      const isCharDecimal = decimal && char === decimal;
      if (isCharDigit || isCharGroup || isCharDecimal) {
        if (isCharDecimal) {
          // Prevent multiple decimal separators and decimals for zero decimal currencies
          if (isDecimalPresent || isZeroDecimal) {
            continue;
          } else {
            isDecimalPresent = true;
            // Force leading 0 for decimal-only values (for parseCurrencyString)
            if (digitCount === 0) {
              tokens.push({ char: '0', index, mask: false });
            }
          }
        }

        if (/\d/.test(char)) {
          // Prevent starting a number with multiple 0's
          if (char === '0') {
            if (digitCount === 0) {
              firstDigitWasZero = true;
            } else if (firstDigitWasZero) {
              continue;
            }
          }

          digitCount += 1;
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

  const inputMaxLength = useMemo<number | undefined>(() => {
    if (!currencyFormat) {
      return;
    }

    const {
      currency: normalizedCurrency,
      symbolPrefix,
      symbolSuffix,
    } = currencyFormat;

    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(normalizedCurrency);
    const maxNonDecimalDigits = isZeroDecimal
      ? AMOUNT_MAX_DIGITS_STRIPE
      : AMOUNT_MAX_DIGITS_STRIPE - 2;
    const lengthForDecimal = isZeroDecimal ? 0 : 3;
    return (
      symbolPrefix.length +
      maxNonDecimalDigits +
      lengthForDecimal +
      symbolSuffix.length
    );
  }, [currencyFormat]);

  const ensureInputCaretPosition = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    // If the only value is the prefilled currency symbol, then set the input caret
    // position to the correct position it should be in based on locale-currency config.
    const inputValue = input.value;
    const lastIndex = inputValue.length;
    const { symbolPrefix, symbolSuffix } = currencyFormat ?? {};
    if (symbolPrefix && inputValue === symbolPrefix) {
      // Prefix, set selection to the end
      input.setSelectionRange(lastIndex, lastIndex);
    } else if (symbolSuffix && inputValue.includes(symbolSuffix)) {
      // Suffix, set selection to before symbol
      if (
        input.selectionStart === input.selectionEnd &&
        input.selectionStart === lastIndex
      ) {
        const indexBeforeSymbol = lastIndex - symbolSuffix.length;
        input.setSelectionRange(indexBeforeSymbol, indexBeforeSymbol);
      }
    }
  }, [currencyFormat]);

  const handleInput = useCallback(
    (event: FormEvent<HTMLInputElement>) => {
      onValueChange(event.currentTarget.value);
      ensureInputCaretPosition();
    },
    [ensureInputCaretPosition, onValueChange]
  );

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    // If we're missing the currency symbol then add it. This can happen if the user
    // tries to delete it, or goes forward to the payment card form then goes back,
    // prefilling the last custom amount
    if (value || document.activeElement === input) {
      const { symbolPrefix, symbolSuffix } = currencyFormat ?? {};
      if (symbolPrefix && !value.includes(symbolPrefix)) {
        onValueChange(`${symbolPrefix}${value}`);
      }
      if (symbolSuffix && !value.includes(symbolSuffix)) {
        onValueChange(`${value}${symbolSuffix}`);
      }
    }

    ensureInputCaretPosition();
  }, [currencyFormat, ensureInputCaretPosition, onValueChange, value]);

  useEffect(() => {
    const input = inputRef.current;
    if (input === undefined) {
      return;
    }

    // We prefill currency symbols after focus and want to control the initial
    // caret position, however MouseDown events override the caret depending on
    // where you click (left or right half of the input box). By overriding
    // the default event with a manual focus, the caret position becomes consistent.
    function ensureMouseDownCaretConsistency(event: MouseEvent) {
      // Skip if input contains content. The user may want to move the caret
      // intentionally.
      if (input?.value) {
        return;
      }

      input?.focus();
      event.preventDefault();
    }

    input?.addEventListener('mousedown', ensureMouseDownCaretConsistency);

    return () => {
      input?.removeEventListener('mousedown', ensureMouseDownCaretConsistency);
    };
  }, []);

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
      spellCheck={false}
      maxLength={inputMaxLength}
      value={value}
      onInput={handleInput}
      onFocus={onFocusWithCurrencyHandler}
      onBlur={onBlurWithCurrencyHandler}
    />
  );
});
