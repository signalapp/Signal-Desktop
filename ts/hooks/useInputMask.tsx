// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  minimask,
  createCreditCardExpirationFormatter,
} from '@signalapp/minimask';
import type { FormatterToken, Formatter } from '@signalapp/minimask';
import type { RefObject } from 'react';
import { useEffect } from 'react';
import creditCardType from 'credit-card-type';
import { strictAssert } from '../util/assert.std.js';

export function useInputMask(
  inputRef: RefObject<HTMLInputElement>,
  formatter: Formatter
): void {
  useEffect(() => {
    strictAssert(inputRef.current, 'Missing input ref');
    const input = inputRef.current;
    return minimask(input, formatter);
  }, [inputRef, formatter]);
}

export const CC_NUMBER_FORMATTER: Formatter = input => {
  const [cardType] = creditCardType(input);

  const maxLength = cardType != null ? Math.max(...cardType.lengths) : 16;
  const gaps = cardType != null ? cardType.gaps : [4, 8, 12];

  const tokens: Array<FormatterToken> = [];
  let digits = 0;

  for (const [index, char] of input.split('').entries()) {
    // skip non-digits
    if (!/\d/.test(char)) {
      continue;
    }

    // push digits
    tokens.push({ char, index, mask: false });
    digits += 1;

    // insert spaces when needed
    if (gaps.includes(digits)) {
      tokens.push({ char: ' ', index, mask: true });
    }

    // ignore any additional chars
    if (digits >= maxLength) {
      break;
    }
  }

  return tokens;
};

export const CC_EXP_FORMATTER = createCreditCardExpirationFormatter();

// Accept any number of digits, manage max length at the input
export const CC_CVC_FORMATTER: Formatter = input => {
  const tokens: Array<FormatterToken> = [];
  for (const [index, char] of input.split('').entries()) {
    if (/\d/.test(char)) {
      tokens.push({ char, index, mask: false });
    }
  }
  return tokens;
};
