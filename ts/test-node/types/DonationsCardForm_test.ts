// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import type {
  CardFormat,
  CardFormFields,
  CardFormResult,
  CardFormSettings,
} from '../../types/DonationsCardForm.std.js';
import {
  CardCvcError,
  CardExpirationError,
  cardFormToCardDetail,
  CardNumberError,
  getCardFormSettings,
  getPossibleCardCvcSizes,
  getPossibleCardFormats,
  parseCardCvc,
  parseCardExpiration,
  parseCardForm,
  parseCardNumber,
} from '../../types/DonationsCardForm.std.js';
import type { CardDetail } from '../../types/Donations.std.js';

function testCard(cardNumber: string, cvcSize: number) {
  return { cardNumber, cvcSize };
}

const STRIPE_TEST_CARDS = {
  VISA: testCard('4242424242424242', 3),
  VISA_DEBIT: testCard('4000056655665556', 3),
  MASTERCARD: testCard('5555555555554444', 3),
  MASTERCARD_2_SERIES: testCard('2223003122003222', 3),
  MASTERCARD_DEBIT: testCard('5200828282828210', 3),
  MASTERCARD_PREPAID: testCard('5105105105105100', 3),
  AMERICAN_EXPRESS: testCard('378282246310005', 4),
  AMERICAN_EXPRESS_2: testCard('371449635398431', 4),
  DISCOVER: testCard('6011111111111117', 3),
  DISCOVER_2: testCard('6011000990139424', 3),
  DISCOVER_DEBIT: testCard('6011981111111113', 3),
  DINERS_CLUB: testCard('3056930009020004', 3),
  DINERS_CLUB_14_DIGIT_CARD: testCard('36227206271667', 3),
  BC_CARD_AND_DINA_CARD: testCard('6555900000604105', 3),
  JCB: testCard('3566002020360505', 3),
  UNION_PAY: testCard('6200000000000005', 3),
  UNION_PAY_DEBIT: testCard('6200000000000047', 3),
  UNION_PAY_19_DIGIT_CARD: testCard('6205500000000000004', 3),
} as const;

function declinedCard(
  cardNumber: string,
  errorCode: string,
  declineCode: string | null = null
) {
  // note: these are all visa numbers so cvcSize is always 3
  return { cardNumber, cvcSize: 3, errorCode, declineCode };
}

const STRIPE_DECLINED_CARDS = {
  GENERIC: declinedCard('4000000000000002', 'card_declined', 'generic_decline'),
  INSUFFICIENT_FUNDS: declinedCard(
    '4000000000009995',
    'card_declined',
    'insufficient_funds'
  ),
  LOST: declinedCard('4000000000009987', 'card_declined', 'lost_card'),
  STOLE: declinedCard('4000000000009979', 'card_declined', 'stolen_card'),
  EXPIRED: declinedCard('4000000000000069', 'expired_card'),
  INCORRECT_CVC: declinedCard('4000000000000127', 'incorrect_cvc'),
  PROCESSING_ERROR: declinedCard('4000000000000119', 'processing_error'),
  INCORRECT_NUMBER: declinedCard('4242424242424241', 'incorrect_number'),
  EXCEEDING_VELOCITY_LIMIT: declinedCard(
    '4000000000006975',
    'card_declined',
    'card_velocity_exceeded'
  ),
} as const;

const CARD_FORMATS = {
  // starts with 4
  VISA: {
    _debugName: 'Visa',
    cardNumber: { digitsLengths: [16, 18, 19], digitsGaps: [4, 8, 12] },
    cardCvc: { name: 'CVV', digitsLength: 3 },
  },
  // starts with 51-55, 2221-2229, 223-229, 23-26, 270-271, 2720
  MASTERCARD: {
    _debugName: 'Mastercard',
    cardNumber: { digitsLengths: [16], digitsGaps: [4, 8, 12] },
    cardCvc: { name: 'CVC', digitsLength: 3 },
  },
  // starts with 34, 37
  AMERICAN_EXPRESS: {
    _debugName: 'American Express',
    cardNumber: { digitsLengths: [15], digitsGaps: [4, 10] },
    cardCvc: { name: 'CID', digitsLength: 4 },
  },
  // starts with 300-305, 36, 38, 39
  DINERS_CLUB: {
    _debugName: 'Diners Club',
    cardNumber: { digitsLengths: [14, 16, 19], digitsGaps: [4, 10] },
    cardCvc: { name: 'CVV', digitsLength: 3 },
  },
  // starts with 6011, 644-649, 65
  DISCOVER: {
    _debugName: 'Discover',
    cardNumber: { digitsLengths: [16, 19], digitsGaps: [4, 8, 12] },
    cardCvc: { name: 'CID', digitsLength: 3 },
  },
  // starts with 2131, 1800, 3528-3589
  JCB: {
    _debugName: 'JCB',
    cardNumber: { digitsLengths: [16, 17, 18, 19], digitsGaps: [4, 8, 12] },
    cardCvc: { name: 'CVV', digitsLength: 3 },
  },
} as const satisfies Record<string, CardFormat>;

describe('DonationsCardForm', () => {
  describe('getPossibleCardFormats', () => {
    function check(input: string, expected: ReadonlyArray<CardFormat>) {
      assert.deepEqual(getPossibleCardFormats(input), expected);
    }

    it('full visa card', () => {
      check(STRIPE_TEST_CARDS.VISA.cardNumber, [CARD_FORMATS.VISA]);
    });
    it('partial visa card', () => {
      check('42', [CARD_FORMATS.VISA]);
    });
    it('full mastercard', () => {
      check(STRIPE_TEST_CARDS.MASTERCARD.cardNumber, [CARD_FORMATS.MASTERCARD]);
    });
    it('partial mastercard', () => {
      check('55', [CARD_FORMATS.MASTERCARD]);
    });
    it('multiple possibilities', () => {
      check('3', [
        CARD_FORMATS.AMERICAN_EXPRESS,
        CARD_FORMATS.DINERS_CLUB,
        CARD_FORMATS.JCB,
      ]);
    });
    it('empty', () => {
      const allPossibilities = getPossibleCardFormats('');
      assert.equal(allPossibilities.length, 12);
    });
    it('invalid', () => {
      check('1111', []);
    });
  });

  describe('getCardFormSettings', () => {
    function check(
      input: ReadonlyArray<CardFormat>,
      expected: CardFormSettings
    ) {
      assert.deepEqual(getCardFormSettings(input), expected);
    }
    it('none (invalid input)', () => {
      check([], {
        cardNumber: { maxInputLength: 19 },
        cardCvc: { label: 'CVV', maxInputLength: 3 },
      });
    });
    it('visa', () => {
      check([CARD_FORMATS.VISA], {
        cardNumber: { maxInputLength: 22 },
        cardCvc: { label: 'CVV', maxInputLength: 3 },
      });
    });
    it('amex', () => {
      check([CARD_FORMATS.AMERICAN_EXPRESS], {
        cardNumber: { maxInputLength: 17 },
        cardCvc: { label: 'CID', maxInputLength: 4 },
      });
    });
    it('multiple (partial input)', () => {
      check(
        [
          CARD_FORMATS.AMERICAN_EXPRESS,
          CARD_FORMATS.DINERS_CLUB,
          CARD_FORMATS.JCB,
        ],
        {
          cardNumber: { maxInputLength: 22 },
          cardCvc: { label: 'CID', maxInputLength: 4 },
        }
      );
    });
    it('all (empty input)', () => {
      check(getPossibleCardFormats(''), {
        cardNumber: { maxInputLength: 22 },
        cardCvc: { label: 'CVV', maxInputLength: 4 },
      });
    });
  });

  describe('getPossibleCardCVCSizes', () => {
    function check(
      input: ReadonlyArray<CardFormat>,
      expected: ReadonlyArray<number>
    ) {
      assert.deepEqual(
        getPossibleCardCvcSizes(input).digitsLengths,
        new Set(expected)
      );
    }

    it('none (invalid input)', () => {
      check([], [3, 4]);
    });
    it('visa', () => {
      check([CARD_FORMATS.VISA], [3]);
    });
    it('amex', () => {
      check([CARD_FORMATS.AMERICAN_EXPRESS], [4]);
    });
    it('multiple (partial input)', () => {
      check(
        [
          CARD_FORMATS.AMERICAN_EXPRESS,
          CARD_FORMATS.DINERS_CLUB,
          CARD_FORMATS.JCB,
        ],
        [3, 4]
      );
    });
    it('all (empty input)', () => {
      check(getPossibleCardFormats(''), [3, 4]);
    });
  });

  describe('parseCardNumber', () => {
    function checkValid(input: string, digits: string) {
      it(`${JSON.stringify(input)} -> ${digits} (valid)`, () => {
        assert.deepEqual(parseCardNumber(input), { digits });
      });
    }

    function checkErrorWithValues(
      input: string,
      error: CardNumberError,
      digits: string
    ) {
      it(`${JSON.stringify(input)} -> ${error} (error with values)`, () => {
        assert.deepEqual(parseCardNumber(input), { error, digits });
      });
    }

    function checkError(input: string, error: CardNumberError) {
      it(`${JSON.stringify(input)} -> ${error} (error)`, () => {
        assert.deepEqual(parseCardNumber(input), { error });
      });
    }

    checkError('', CardNumberError.EMPTY);
    checkError('  ', CardNumberError.EMPTY);
    checkError('\t', CardNumberError.EMPTY);
    checkError('!@#$', CardNumberError.INVALID_CHARS);
    checkError('4242-4242-4242-4242', CardNumberError.INVALID_CHARS);
    checkError('42', CardNumberError.INVALID_OR_INCOMPLETE_NUMBER);
    checkError('42', CardNumberError.INVALID_OR_INCOMPLETE_NUMBER);
    checkError('  42  ', CardNumberError.INVALID_OR_INCOMPLETE_NUMBER);
    checkError('4242    4242', CardNumberError.INVALID_OR_INCOMPLETE_NUMBER);

    // not a real number
    checkErrorWithValues(
      '0000 0000 0000 0000',
      CardNumberError.INVALID_NUMBER,
      '0000000000000000'
    );
    // wrong luhn number
    checkErrorWithValues(
      '4242 4242 4242 4242 427',
      CardNumberError.INVALID_NUMBER,
      '4242424242424242427'
    );

    checkValid('4242 4242 4242 4242 428', '4242424242424242428');
    checkValid('4242424242424242', '4242424242424242');
    checkValid('4242 4242 4242 4242', '4242424242424242');
    checkValid(' 4 2 4 2 4 2 4 2 4 2 4 2 4 2 4 2 ', '4242424242424242');
    checkValid('4242   4242   4242   4242', '4242424242424242');
  });

  describe('parseCardExpiration', () => {
    function checkValid(input: string, month: string, year: string) {
      it(`${JSON.stringify(input)} -> ${month}/${year} (valid)`, () => {
        assert.deepEqual(parseCardExpiration(input), { month, year });
      });
    }

    function checkErrorWithValues(
      input: string,
      error: CardExpirationError,
      month: string,
      year: string
    ) {
      it(`${JSON.stringify(input)} -> ${error} (error with values)`, () => {
        assert.deepEqual(parseCardExpiration(input), {
          error,
          month,
          year,
        });
      });
    }

    function checkError(input: string, error: CardExpirationError) {
      it(`${JSON.stringify(input)} -> ${error} (error)`, () => {
        assert.deepEqual(parseCardExpiration(input), { error });
      });
    }

    const now = new Date();

    const currMonth = now.getMonth() + 1;
    const currYear = now.getFullYear();
    const lastMonth = currMonth - 1;
    const lastYear = currYear - 1;
    const nextMonth = currMonth + 1;
    const nextYear = currYear + 1;

    const mm = (month: number) => String(month).padStart(2, '0');
    const yy = (year: number) => String(year - 2000).padStart(2, '0');
    const yyyy = (year: number) => String(year).padStart(4, '0');
    const mmyy = (month: number, year: number) => `${mm(month)}/${yy(year)}`;

    checkError('', CardExpirationError.EMPTY);
    checkError('  ', CardExpirationError.EMPTY);
    checkError('\t', CardExpirationError.EMPTY);
    checkError('!@#$', CardExpirationError.INVALID_CHARS);
    checkError('12-34', CardExpirationError.INVALID_CHARS);
    checkError('12 34', CardExpirationError.INVALID_CHARS);
    checkError('/', CardExpirationError.MONTH_EMPTY);
    checkError('/3', CardExpirationError.MONTH_EMPTY);
    checkError('/34', CardExpirationError.MONTH_EMPTY);
    checkError('/3/4', CardExpirationError.TOO_MANY_SLASHES);
    checkError('12', CardExpirationError.YEAR_MISSING);
    checkError('12/', CardExpirationError.YEAR_EMPTY);
    checkError('12/3', CardExpirationError.YEAR_TOO_SHORT);
    checkError('12/333', CardExpirationError.YEAR_TOO_LONG);
    checkError('12/2000', CardExpirationError.YEAR_TOO_LONG);
    checkError('12/3/', CardExpirationError.TOO_MANY_SLASHES);
    checkError('12/3/4', CardExpirationError.TOO_MANY_SLASHES);
    checkError('12/00', CardExpirationError.EXPIRED_PAST_YEAR);
    checkError('13/34', CardExpirationError.MONTH_OUT_OF_RANGE);
    checkError('99/34', CardExpirationError.MONTH_OUT_OF_RANGE);
    checkError('00/34', CardExpirationError.MONTH_OUT_OF_RANGE);

    const { EXPIRED_PAST_YEAR, EXPIRED_EARLIER_IN_YEAR } = CardExpirationError;

    checkError(mmyy(lastMonth, lastYear), EXPIRED_PAST_YEAR);
    checkError(mmyy(currMonth, lastYear), EXPIRED_PAST_YEAR);
    checkError(mmyy(nextMonth, lastYear), EXPIRED_PAST_YEAR);

    checkErrorWithValues(
      mmyy(lastMonth, currYear),
      EXPIRED_EARLIER_IN_YEAR,
      mm(lastMonth),
      yyyy(currYear)
    );
    checkValid(mmyy(currMonth, currYear), mm(currMonth), yyyy(currYear)); // accept current month
    checkValid(mmyy(nextMonth, currYear), mm(nextMonth), yyyy(currYear));

    checkValid(mmyy(lastMonth, nextYear), mm(lastMonth), yyyy(nextYear));
    checkValid(mmyy(currMonth, nextYear), mm(currMonth), yyyy(nextYear));
    checkValid(mmyy(nextMonth, nextYear), mm(nextMonth), yyyy(nextYear));
  });

  describe('parseCardCvc', () => {
    function checkValid(
      input: string,
      possibleCardFormats: ReadonlyArray<CardFormat>,
      digits: string
    ) {
      it(`${JSON.stringify(input)} -> ${digits} (valid)`, () => {
        assert.deepEqual(parseCardCvc(input, possibleCardFormats), { digits });
      });
    }

    function checkErrorWithValues(
      input: string,
      possibleCardFormats: ReadonlyArray<CardFormat>,
      error: CardCvcError,
      digits: string
    ) {
      it(`${JSON.stringify(input)} -> ${error} (error with values)`, () => {
        assert.deepEqual(parseCardCvc(input, possibleCardFormats), {
          error,
          digits,
        });
      });
    }

    function checkError(
      input: string,
      possibleCardFormats: ReadonlyArray<CardFormat>,
      error: CardCvcError
    ) {
      it(`${JSON.stringify(input)} -> ${error} (error)`, () => {
        assert.deepEqual(parseCardCvc(input, possibleCardFormats), {
          error,
        });
      });
    }

    const NONE: ReadonlyArray<CardFormat> = [];
    const VISA = [CARD_FORMATS.VISA];
    const AMEX = [CARD_FORMATS.AMERICAN_EXPRESS];
    const BOTH = [CARD_FORMATS.VISA, CARD_FORMATS.AMERICAN_EXPRESS];

    checkError('', NONE, CardCvcError.EMPTY);
    checkError('  ', NONE, CardCvcError.EMPTY);
    checkError('\t', NONE, CardCvcError.EMPTY);
    checkError('\t', NONE, CardCvcError.EMPTY);
    checkError('!@#$', NONE, CardCvcError.INVALID_CHARS);
    checkValid('123', NONE, '123');
    checkError('12', VISA, CardCvcError.LENGTH_TOO_SHORT);
    checkValid('123', VISA, '123');
    checkErrorWithValues('1234', VISA, CardCvcError.LENGTH_TOO_LONG, '1234');
    checkErrorWithValues('123', AMEX, CardCvcError.LENGTH_TOO_SHORT, '123');
    checkValid('1234', AMEX, '1234');
    checkError('12345', AMEX, CardCvcError.LENGTH_TOO_LONG);
    checkError('12', BOTH, CardCvcError.LENGTH_TOO_SHORT);
    checkValid('123', BOTH, '123');
    checkValid('1234', BOTH, '1234');
    checkError('12345', BOTH, CardCvcError.LENGTH_TOO_LONG);
    checkError('12345', BOTH, CardCvcError.LENGTH_TOO_LONG);
  });

  describe('parseCardForm', () => {
    function check(
      name: string,
      input: CardFormFields,
      expected: CardFormResult
    ) {
      it(name, () => {
        assert.deepEqual(parseCardForm(input), expected);
      });
    }

    function fields(
      cardNumber: string,
      cardExpiration: string,
      cardCvc: string
    ) {
      return { cardNumber, cardExpiration, cardCvc };
    }

    const VISA = STRIPE_TEST_CARDS.VISA.cardNumber;
    const AMEX = STRIPE_TEST_CARDS.AMERICAN_EXPRESS.cardNumber;

    check('all empty', fields('', '', ''), {
      cardNumber: { error: CardNumberError.EMPTY },
      cardExpiration: { error: CardExpirationError.EMPTY },
      cardCvc: { error: CardCvcError.EMPTY },
    });

    check('valid visa', fields(VISA, '12/34', '123'), {
      cardNumber: { digits: VISA },
      cardExpiration: { month: '12', year: '2034' },
      cardCvc: { digits: '123' },
    });

    check('valid amex', fields(AMEX, '12/34', '1234'), {
      cardNumber: { digits: AMEX },
      cardExpiration: { month: '12', year: '2034' },
      cardCvc: { digits: '1234' },
    });

    check('valid amex, too short code', fields(AMEX, '12/34', '123'), {
      cardNumber: { digits: AMEX },
      cardExpiration: { month: '12', year: '2034' },
      cardCvc: { digits: '123', error: CardCvcError.LENGTH_TOO_SHORT },
    });

    check('partial amex, too short code', fields('34', '12/34', '123'), {
      cardNumber: { error: CardNumberError.INVALID_OR_INCOMPLETE_NUMBER },
      cardExpiration: { month: '12', year: '2034' },
      cardCvc: { digits: '123', error: CardCvcError.LENGTH_TOO_SHORT },
    });

    check('partial card (multiple matches)', fields('3', '12/34', '123'), {
      cardNumber: { error: CardNumberError.INVALID_OR_INCOMPLETE_NUMBER },
      cardExpiration: { month: '12', year: '2034' },
      cardCvc: { digits: '123' },
    });

    // verify all of the test cards pass form validation
    describe('stripe test numbers', () => {
      function checkTestCard(
        name: string,
        cardNumber: string,
        cvcSize: number
      ) {
        const cvc = '1234'.slice(0, cvcSize);
        check(name, fields(cardNumber, '12/34', cvc), {
          cardNumber: { digits: cardNumber },
          cardExpiration: { month: '12', year: '2034' },
          cardCvc: { digits: cvc },
        });
      }

      for (const [name, card] of Object.entries(STRIPE_TEST_CARDS)) {
        checkTestCard(name, card.cardNumber, card.cvcSize);
      }
      for (const [name, card] of Object.entries(STRIPE_DECLINED_CARDS)) {
        // skipped
        if (name === 'INCORRECT_NUMBER') {
          continue;
        }
        checkTestCard(name, card.cardNumber, card.cvcSize);
      }
    });
  });

  describe('cardFormToCardDetail', () => {
    function check(
      name: string,
      input: CardFormFields,
      expected: CardDetail | null
    ) {
      it(name, () => {
        assert.deepEqual(cardFormToCardDetail(parseCardForm(input)), expected);
      });
    }

    function fields(
      cardNumber: string,
      cardExpiration: string,
      cardCvc: string
    ) {
      return { cardNumber, cardExpiration, cardCvc };
    }

    const VISA = STRIPE_TEST_CARDS.VISA.cardNumber;
    const AMEX = STRIPE_TEST_CARDS.AMERICAN_EXPRESS.cardNumber;

    const VISA_CARD_DETAIL: CardDetail = {
      number: VISA,
      expirationMonth: '12',
      expirationYear: '2034',
      cvc: '123',
    };
    const AMEX_CARD_DETAIL: CardDetail = {
      number: AMEX,
      expirationMonth: '12',
      expirationYear: '2034',
      cvc: '1234',
    };

    check('all empty', fields('', '', ''), null);
    check('valid visa', fields(VISA, '12/34', '123'), VISA_CARD_DETAIL);
    check('valid visa, invalid date', fields(VISA, '12/', '123'), null);
    check('valid amex', fields(AMEX, '12/34', '1234'), AMEX_CARD_DETAIL);
    check('valid amex with too short code', fields(AMEX, '12/34', '123'), {
      number: AMEX,
      expirationMonth: '12',
      expirationYear: '2034',
      cvc: '123',
    });
    check('partial amex, too short code', fields('34', '12/34', '123'), null);
    check('partial card (multiple matches)', fields('3', '12/34', '123'), null);
  });
});
