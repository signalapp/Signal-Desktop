// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import cardValidator from 'card-validator';
import creditCardType from 'credit-card-type';
import { strictAssert } from '../util/assert.std.js';
import type { CardDetail } from './Donations.std.js';

export type CardFormat = Readonly<{
  _debugName: string;
  cardNumber: Readonly<{
    digitsLengths: ReadonlyArray<number>;
    digitsGaps: ReadonlyArray<number>;
  }>;
  cardCvc: Readonly<{
    name: string;
    digitsLength: number;
  }>;
}>;

export type CardFormSettings = Readonly<{
  cardNumber: {
    maxInputLength: number;
  };
  cardCvc: {
    label: string;
    maxInputLength: number;
  };
}>;

export enum CardNumberError {
  EMPTY = 'EMPTY',
  INVALID_CHARS = 'INVALID_CHARS',
  INVALID_OR_INCOMPLETE_NUMBER = 'INVALID_OR_INCOMPLETE_NUMBER',
  INVALID_NUMBER = 'INVALID_NUMBER',
}

export enum CardExpirationError {
  EMPTY = 'EMPTY',
  INVALID_CHARS = 'INVALID_CHARS',
  TOO_MANY_SLASHES = 'TOO_MANY_SLASHES',
  MONTH_EMPTY = 'MONTH_EMPTY',
  MONTH_TOO_LONG = 'MONTH_TOO_LONG',
  YEAR_MISSING = 'YEAR_MISSING',
  YEAR_EMPTY = 'YEAR_EMPTY',
  YEAR_TOO_SHORT = 'YEAR_TOO_SHORT',
  YEAR_TOO_LONG = 'YEAR_TOO_LONG',
  MONTH_INVALID_INTEGER = 'MONTH_INVALID_INTEGER',
  YEAR_INVALID_INTEGER = 'YEAR_INVALID_INTEGER',
  MONTH_OUT_OF_RANGE = 'MONTH_OUT_OF_RANGE',
  EXPIRED_PAST_YEAR = 'EXPIRED_PAST_YEAR',
  EXPIRED_EARLIER_IN_YEAR = 'EXPIRED_EARLIER_IN_YEAR',
  YEAR_TOO_FAR_IN_FUTURE = 'YEAR_TOO_FAR_IN_FUTURE',
}

export enum CardCvcError {
  EMPTY = 'EMPTY',
  INVALID_CHARS = 'INVALID_CHARS',
  LENGTH_TOO_SHORT = 'INVALID_LENGTH_TOO_SHORT',
  LENGTH_TOO_LONG = 'INVALID_LENGTH_TOO_LONG',
  LENGTH_INVALID = 'INVALID_LENGTH',
}

export type CardNumberResult =
  | Readonly<{ digits: string; error?: never }>
  | Readonly<{ digits?: string; error: CardNumberError }>;

export type CardExpirationResult =
  | Readonly<{ month: string; year: string; error?: never }>
  | Readonly<{ month?: string; year?: string; error: CardExpirationError }>;

export type CardCvcResult =
  | Readonly<{ digits: string; error?: never }>
  | Readonly<{ digits?: string; error: CardCvcError }>;

export type CardFormFields = Readonly<{
  cardNumber: string;
  cardExpiration: string;
  cardCvc: string;
}>;

export type CardFormResult = Readonly<{
  cardNumber: CardNumberResult;
  cardExpiration: CardExpirationResult;
  cardCvc: CardCvcResult;
}>;

export type CardFormData = Readonly<{
  cardNumber: { digits: string };
  cardExpiration: { month: string; year: string };
  cardCvc: { digits: string };
}>;

export function getPossibleCardFormats(
  input: string
): ReadonlyArray<CardFormat> {
  return creditCardType(input).map((cardType): CardFormat => {
    return {
      _debugName: cardType.niceType,
      cardNumber: {
        digitsLengths: cardType.lengths,
        digitsGaps: cardType.gaps,
      },
      cardCvc: {
        name: cardType.code.name,
        digitsLength: cardType.code.size,
      },
    };
  });
}

const DEFAULT_CARD_NUMBER_MAX_INPUT_LENGTH = 16 + 3; // 16 digits + 3 spaces
const DEFAULT_CARD_CVC_LABEL = 'CVV';
const DEFAULT_CARD_CVC_MAX_INPUT_LENGTH = 3;

export function getCardFormSettings(
  possibleCardFormats: ReadonlyArray<CardFormat>
): CardFormSettings {
  let numberMaxInputLength: number | null = null;
  let cvcLabel: string | null = null;
  let cvcMaxInputLength: number | null = null;

  for (const format of possibleCardFormats) {
    const maxDigitsLength = Math.max(...format.cardNumber.digitsLengths);
    numberMaxInputLength = Math.max(
      numberMaxInputLength ?? -1,
      maxDigitsLength + format.cardNumber.digitsGaps.length
    );
    cvcLabel ??= format.cardCvc.name;
    cvcMaxInputLength = Math.max(
      cvcMaxInputLength ?? -1,
      format.cardCvc.digitsLength
    );
  }

  numberMaxInputLength ??= DEFAULT_CARD_NUMBER_MAX_INPUT_LENGTH;
  cvcLabel ??= DEFAULT_CARD_CVC_LABEL;
  cvcMaxInputLength ??= DEFAULT_CARD_CVC_MAX_INPUT_LENGTH;

  return {
    cardNumber: {
      maxInputLength: numberMaxInputLength,
    },
    cardCvc: {
      label: cvcLabel,
      maxInputLength: cvcMaxInputLength,
    },
  };
}

export type PossibleCardCvcSizes = Readonly<{
  minDigitsLength: number;
  maxDigitsLength: number;
  digitsLengths: Set<number>;
}>;

const DEFAULT_POSSIBLE_CARD_CVC_SIZES: PossibleCardCvcSizes = {
  minDigitsLength: 3,
  maxDigitsLength: 4,
  digitsLengths: new Set([3, 4]),
};

export function getPossibleCardCvcSizes(
  possibleCardFormats: ReadonlyArray<CardFormat>
): PossibleCardCvcSizes {
  const digitsLengths = new Set<number>();

  for (const format of possibleCardFormats) {
    digitsLengths.add(format.cardCvc.digitsLength);
  }

  if (digitsLengths.size === 0) {
    return DEFAULT_POSSIBLE_CARD_CVC_SIZES;
  }

  const minDigitsLength = Math.min(...digitsLengths);
  const maxDigitsLength = Math.max(...digitsLengths);

  return { minDigitsLength, maxDigitsLength, digitsLengths };
}

export function parseCardNumber(input: string): CardNumberResult {
  // Trim whitespace and check if empty
  const trimmed = input.trim();
  if (trimmed === '') {
    return { error: CardNumberError.EMPTY };
  }

  // Check the input only contains digits and spaces
  const invalidChars = trimmed.match(/[^\d ]/);
  if (invalidChars != null) {
    return { error: CardNumberError.INVALID_CHARS };
  }

  // Take all the digits
  const digits = trimmed.match(/\d/g)?.join('') ?? '';
  const result = cardValidator.number(digits, {
    // Note: Almost all cards have Luhn validation, Wikipedia notes a few
    // exceptions (ex: Union Pay & Diners Club enRoute). `card-validator`
    // disables luhn validation for Union Pay and the others are far less common
    //
    // These are the default options from `card-validator` but we may want to
    // change these values later, or base them on the card type
    skipLuhnValidation: false,
    luhnValidateUnionPay: false,
  });

  if (!result.isValid) {
    const error = result.isPotentiallyValid
      ? CardNumberError.INVALID_OR_INCOMPLETE_NUMBER
      : CardNumberError.INVALID_NUMBER;

    // Pass digits through if they are between 12-19 digits
    if (digits.length >= 12 && digits.length <= 19) {
      return { digits, error };
    }

    return { error };
  }

  return { digits };
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isValidMonth(value: number): boolean {
  return value >= 1 && value <= 12;
}

const CARD_EXPIRATION_MAX_YEARS_IN_FUTURE = 50;

export function parseCardExpiration(input: string): CardExpirationResult {
  // Trim whitespace and check if empty
  const trimmed = input.trim();
  if (trimmed === '') {
    return { error: CardExpirationError.EMPTY };
  }

  // Check the input only contains numbers and slashes
  const invalidChars = trimmed.match(/[^\d\\/]/);
  if (invalidChars != null) {
    return { error: CardExpirationError.INVALID_CHARS };
  }

  // Split the input on slashes and check each part individually
  const [monthPart, yearPart, ...extraParts] = trimmed.split('/');

  // Check that we don't have any extra segments
  if (extraParts.length > 0) {
    return { error: CardExpirationError.TOO_MANY_SLASHES };
  }
  // Check that we have a month
  if (monthPart.length === 0) {
    return { error: CardExpirationError.MONTH_EMPTY };
  }
  // Check that the month is 1-2 digits
  if (monthPart.length > 2) {
    return { error: CardExpirationError.MONTH_TOO_LONG };
  }
  // Check that we have a year
  if (yearPart == null) {
    return { error: CardExpirationError.YEAR_MISSING };
  }
  // Check that the year isn't empty
  if (yearPart.length === 0) {
    return { error: CardExpirationError.YEAR_EMPTY };
  }
  // Check that the year isn't 1 digit long
  if (yearPart.length < 2) {
    return { error: CardExpirationError.YEAR_TOO_SHORT };
  }
  // Check that the year isn't 3+ digits long
  if (yearPart.length > 2) {
    return { error: CardExpirationError.YEAR_TOO_LONG };
  }

  // Convert the parts into numbers to compare them against today's date
  const monthNumber = Number(monthPart);
  const relativeYearNumber = Number(yearPart);

  // Make sure the month and year both parse as a positive integer
  if (!isPositiveInteger(monthNumber)) {
    return { error: CardExpirationError.MONTH_INVALID_INTEGER };
  }
  if (!isPositiveInteger(relativeYearNumber)) {
    return { error: CardExpirationError.YEAR_INVALID_INTEGER };
  }

  // Since we're using a 2-digit number, add 2000 to the year
  const yearNumber = relativeYearNumber + 2000;

  // Format the month and year how stripe expects them
  const month = String(monthNumber).padStart(2, '0');
  const year = String(yearNumber).padStart(4, '0');

  // Check that the month is a real month of the year
  if (!isValidMonth(monthNumber)) {
    return { error: CardExpirationError.MONTH_OUT_OF_RANGE };
  }

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Check that the year isn't already in the past
  if (yearNumber < currentYear) {
    return { error: CardExpirationError.EXPIRED_PAST_YEAR };
  }
  // Check that the month isn't earlier in this year
  if (yearNumber === currentYear && monthNumber < currentMonth) {
    return { month, year, error: CardExpirationError.EXPIRED_EARLIER_IN_YEAR };
  }

  // Check that the year isn't too far into the future
  const maxYear = currentYear + CARD_EXPIRATION_MAX_YEARS_IN_FUTURE;
  if (yearNumber > maxYear) {
    return { month, year, error: CardExpirationError.YEAR_TOO_FAR_IN_FUTURE };
  }

  strictAssert(month.length === 2, 'parseCardExpiration: Invalid month length');
  strictAssert(year.length === 4, 'parseCardExpiration: Invalid year length');

  return { month, year };
}

export function parseCardCvc(
  input: string,
  possibleCardFormats: ReadonlyArray<CardFormat>
): CardCvcResult {
  // Trim whitespace and check if empty
  const digits = input.trim();
  if (digits === '') {
    return { error: CardCvcError.EMPTY };
  }

  // Check the input only contains numbers
  const invalidChars = digits.match(/[^\d]/);
  if (invalidChars != null) {
    return { error: CardCvcError.INVALID_CHARS };
  }

  // Validate that we have the right number of digits
  const possibleCardCvcSizes = getPossibleCardCvcSizes(possibleCardFormats);

  let error: CardCvcError | null = null;

  if (digits.length < possibleCardCvcSizes.minDigitsLength) {
    error = CardCvcError.LENGTH_TOO_SHORT;
  } else if (digits.length > possibleCardCvcSizes.maxDigitsLength) {
    error = CardCvcError.LENGTH_TOO_LONG;
  } else if (!possibleCardCvcSizes.digitsLengths.has(digits.length)) {
    error = CardCvcError.LENGTH_INVALID;
  }

  if (error != null) {
    // Pass digits through if they are between 3-4 digits
    if (digits.length >= 3 && digits.length <= 4) {
      return { digits, error };
    }
    return { error };
  }

  return { digits };
}

export function parseCardForm(fields: CardFormFields): CardFormResult {
  const possibleCardFormats = getPossibleCardFormats(fields.cardNumber);
  const cardNumber = parseCardNumber(fields.cardNumber);
  const cardExpiration = parseCardExpiration(fields.cardExpiration);
  const cardCvc = parseCardCvc(fields.cardCvc, possibleCardFormats);
  return { cardNumber, cardExpiration, cardCvc };
}

export function cardFormToCardDetail(
  result: CardFormResult
): CardDetail | null {
  const number = result.cardNumber.digits;
  const expirationMonth = result.cardExpiration.month;
  const expirationYear = result.cardExpiration.year;
  const cvc = result.cardCvc.digits;

  // This allows us to cast `CardFormResult` to `CardDetail` even if the form
  // has errors as long as the validations got far enough to parse out these
  // values:
  if (
    number == null ||
    expirationMonth == null ||
    expirationYear == null ||
    cvc == null
  ) {
    return null;
  }

  return { number, expirationMonth, expirationYear, cvc };
}
