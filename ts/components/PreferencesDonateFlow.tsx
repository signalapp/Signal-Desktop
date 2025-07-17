// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MutableRefObject } from 'react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { LocalizerType } from '../types/Util';
import { useConfirmDiscard } from '../hooks/useConfirmDiscard';
import { Button, ButtonVariant } from './Button';
import type { HumanDonationAmount } from '../types/Donations';
import {
  ONE_TIME_DONATION_CONFIG_ID,
  type DonationWorkflow,
  type OneTimeDonationHumanAmounts,
} from '../types/Donations';
import type {
  CardCvcError,
  CardExpirationError,
  CardNumberError,
} from '../types/DonationsCardForm';
import {
  cardFormToCardDetail,
  getCardFormSettings,
  getPossibleCardFormats,
  parseCardCvc,
  parseCardExpiration,
  parseCardForm,
  parseCardNumber,
} from '../types/DonationsCardForm';
import {
  brandHumanDonationAmount,
  parseCurrencyString,
  toHumanCurrencyString,
  toStripeDonationAmount,
} from '../util/currency';
import { Input } from './Input';
import { PreferencesContent } from './Preferences';
import type { SubmitDonationType } from '../state/ducks/donations';
import { Select } from './Select';
import {
  DonateInputCardNumber,
  getCardNumberErrorMessage,
} from './preferences/donations/DonateInputCardNumber';
import {
  DonateInputCardExp,
  getCardExpirationErrorMessage,
} from './preferences/donations/DonateInputCardExp';
import {
  DonateInputCardCvc,
  getCardCvcErrorMessage,
} from './preferences/donations/DonateInputCardCvc';

export type PropsDataType = {
  i18n: LocalizerType;
  donationAmountsConfig: OneTimeDonationHumanAmounts | undefined;
  validCurrencies: ReadonlyArray<string>;
  workflow: DonationWorkflow | undefined;
};

type PropsHousekeepingType = {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
};

type PropsActionType = {
  clearWorkflow: () => void;
  submitDonation: (payload: SubmitDonationType) => void;
  onBack: () => void;
};

export type PropsType = PropsDataType & PropsActionType & PropsHousekeepingType;

export function PreferencesDonateFlow({
  contentsRef,
  i18n,
  donationAmountsConfig,
  validCurrencies,
  workflow,
  clearWorkflow,
  submitDonation,
  onBack,
}: PropsType): JSX.Element {
  const tryClose = useRef<() => void | undefined>();
  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard({
    i18n,
    name: 'PreferencesDonateFlow',
    tryClose,
  });

  const [step, setStep] = useState<'amount' | 'paymentDetails'>('amount');

  const [amount, setAmount] = useState<HumanDonationAmount>();
  const [currency, setCurrency] = useState<string>();
  const [cardExpiration, setCardExpiration] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const [cardNumberError, setCardNumberError] =
    useState<CardNumberError | null>(null);
  const [cardExpirationError, setCardExpirationError] =
    useState<CardExpirationError | null>(null);
  const [cardCvcError, setCardCvcError] = useState<CardCvcError | null>(null);

  const possibleCardFormats = useMemo(() => {
    return getPossibleCardFormats(cardNumber);
  }, [cardNumber]);
  const cardFormSettings = useMemo(() => {
    return getCardFormSettings(possibleCardFormats);
  }, [possibleCardFormats]);

  const handleCardNumberChange = useCallback((value: string) => {
    setCardNumber(value);
    setCardNumberError(null);
  }, []);

  const handleCardNumberBlur = useCallback(() => {
    if (cardNumber !== '') {
      const result = parseCardNumber(cardNumber);
      setCardNumberError(result.error ?? null);
    }
  }, [cardNumber]);

  const handleCardExpirationChange = useCallback((value: string) => {
    setCardExpiration(value);
    setCardExpirationError(null);
  }, []);

  const handleCardExpirationBlur = useCallback(() => {
    if (cardExpiration !== '') {
      const result = parseCardExpiration(cardExpiration);
      setCardExpirationError(result.error ?? null);
    }
  }, [cardExpiration]);

  const handleCardCvcChange = useCallback((value: string) => {
    setCardCvc(value);
    setCardCvcError(null);
  }, []);

  const handleCardCvcBlur = useCallback(() => {
    if (cardCvc !== '') {
      const result = parseCardCvc(cardCvc, possibleCardFormats);
      setCardCvcError(result.error ?? null);
    }
  }, [cardCvc, possibleCardFormats]);

  const formattedCurrencyAmount = useMemo<string>(() => {
    return toHumanCurrencyString({ amount, currency });
  }, [amount, currency]);

  const handleAmountPickerResult = useCallback((result: AmountPickerResult) => {
    const { currency: pickedCurrency, amount: pickedAmount } = result;
    setAmount(pickedAmount);
    setCurrency(pickedCurrency);
    setStep('paymentDetails');
  }, []);

  const handleDonateClicked = useCallback(() => {
    if (amount == null || currency == null) {
      return;
    }

    const paymentAmount = toStripeDonationAmount({ amount, currency });
    const formResult = parseCardForm({ cardNumber, cardExpiration, cardCvc });

    setCardNumberError(formResult.cardNumber.error ?? null);
    setCardExpirationError(formResult.cardExpiration.error ?? null);
    setCardCvcError(formResult.cardCvc.error ?? null);

    const cardDetail = cardFormToCardDetail(formResult);
    if (cardDetail == null) {
      return;
    }

    submitDonation({
      currencyType: currency,
      paymentAmount,
      paymentDetail: cardDetail,
    });
  }, [amount, cardCvc, cardExpiration, cardNumber, currency, submitDonation]);

  const isDonateDisabled = workflow !== undefined;

  const onTryClose = useCallback(() => {
    const onDiscard = () => {
      // TODO: DESKTOP-8950
    };

    confirmDiscardIf(true, onDiscard);
  }, [confirmDiscardIf]);
  tryClose.current = onTryClose;

  let innerContent: JSX.Element;
  let handleBack: () => void;

  if (step === 'amount') {
    innerContent = (
      <AmountPicker
        i18n={i18n}
        initialAmount={amount}
        initialCurrency={currency}
        donationAmountsConfig={donationAmountsConfig}
        validCurrencies={validCurrencies}
        onSubmit={handleAmountPickerResult}
      />
    );
    // Dismiss DonateFlow and return to Donations home
    handleBack = () => onBack();
  } else {
    innerContent = (
      <div className="PreferencesDonations">
        {workflow && (
          <div>
            <h2>Current Workflow</h2>
            <blockquote>{JSON.stringify(workflow)}</blockquote>
            <Button onClick={clearWorkflow} variant={ButtonVariant.Destructive}>
              Reset
            </Button>
          </div>
        )}

        <label htmlFor="amount">Amount</label>
        <pre>
          {amount} {currency}
        </pre>
        <label htmlFor="cardNumber">Card Number</label>
        <DonateInputCardNumber
          id="cardNumber"
          value={cardNumber}
          onValueChange={handleCardNumberChange}
          maxInputLength={cardFormSettings.cardNumber.maxInputLength}
          onBlur={handleCardNumberBlur}
        />
        {cardNumberError != null && (
          <span>{getCardNumberErrorMessage(i18n, cardNumberError)}</span>
        )}
        <label htmlFor="cardExpiration">Expiration Date</label>
        <DonateInputCardExp
          id="cardExpiration"
          value={cardExpiration}
          onValueChange={handleCardExpirationChange}
          onBlur={handleCardExpirationBlur}
        />
        {cardExpirationError && (
          <span>
            {getCardExpirationErrorMessage(i18n, cardExpirationError)}
          </span>
        )}
        <label htmlFor="cardCvc">{cardFormSettings.cardCvc.label}</label>
        <DonateInputCardCvc
          id="cardCvc"
          value={cardCvc}
          onValueChange={handleCardCvcChange}
          maxInputLength={cardFormSettings.cardCvc.maxInputLength}
          onBlur={handleCardCvcBlur}
        />
        {cardCvcError && (
          <span>{getCardCvcErrorMessage(i18n, cardCvcError)}</span>
        )}
        <Button
          disabled={isDonateDisabled}
          onClick={handleDonateClicked}
          variant={ButtonVariant.Primary}
        >
          {i18n('icu:PreferencesDonations__donate-button-with-amount', {
            formattedCurrencyAmount,
          })}
        </Button>
      </div>
    );
    handleBack = () => {
      setStep('amount');
    };
  }

  const backButton = (
    <button
      aria-label={i18n('icu:goBack')}
      className="Preferences__back-icon"
      onClick={handleBack}
      type="button"
    />
  );
  const content = (
    <>
      {confirmDiscardModal}
      {innerContent}
    </>
  );

  return (
    <PreferencesContent
      backButton={backButton}
      contents={content}
      contentsRef={contentsRef}
      title={undefined}
    />
  );
}

type AmountPickerResult = {
  amount: HumanDonationAmount;
  currency: string;
};

type AmountPickerProps = {
  i18n: LocalizerType;
  initialAmount: HumanDonationAmount | undefined;
  initialCurrency: string | undefined;
  donationAmountsConfig: OneTimeDonationHumanAmounts | undefined;
  validCurrencies: ReadonlyArray<string>;
  onSubmit: (result: AmountPickerResult) => void;
};

function AmountPicker({
  donationAmountsConfig,
  i18n,
  initialAmount,
  initialCurrency,
  validCurrencies,
  onSubmit,
}: AmountPickerProps): JSX.Element {
  const [currency, setCurrency] = useState(initialCurrency ?? 'usd');

  const [presetAmount, setPresetAmount] = useState<
    HumanDonationAmount | undefined
  >(initialAmount);
  const [customAmount, setCustomAmount] = useState<string>();

  // Reset amount selections when API donation config or selected currency changes
  // Memo here so preset options instantly load when component mounts.
  const presetAmountOptions = useMemo(() => {
    if (!donationAmountsConfig || !donationAmountsConfig[currency]) {
      return [];
    }

    const currencyAmounts = donationAmountsConfig[currency];
    const presets = currencyAmounts.oneTime[ONE_TIME_DONATION_CONFIG_ID] ?? [];
    return presets;
  }, [donationAmountsConfig, currency]);

  useEffect(() => {
    setCustomAmount(undefined);
    setPresetAmount(undefined);
  }, [donationAmountsConfig, currency]);

  const minimumAmount = useMemo<HumanDonationAmount>(() => {
    if (!donationAmountsConfig || !donationAmountsConfig[currency]) {
      return brandHumanDonationAmount(0);
    }

    const currencyAmounts = donationAmountsConfig[currency];
    return currencyAmounts.minimum;
  }, [donationAmountsConfig, currency]);

  const currencyOptionsForSelect = useMemo(() => {
    return validCurrencies.map((currencyString: string) => {
      return { text: currencyString.toUpperCase(), value: currencyString };
    });
  }, [validCurrencies]);

  const { error, parsedCustomAmount } = useMemo<{
    error: 'invalid' | 'amount-below-minimum' | undefined;
    parsedCustomAmount: HumanDonationAmount | undefined;
  }>(() => {
    if (customAmount === '' || customAmount == null) {
      return {
        error: undefined,
        parsedCustomAmount: undefined,
      };
    }

    const parseResult = parseCurrencyString({
      currency,
      value: customAmount,
    });

    if (parseResult != null) {
      if (parseResult >= minimumAmount) {
        // Valid input
        return {
          error: undefined,
          parsedCustomAmount: parseResult,
        };
      }

      return {
        error: 'amount-below-minimum',
        parsedCustomAmount: undefined,
      };
    }

    return {
      error: 'invalid',
      parsedCustomAmount: undefined,
    };
  }, [currency, customAmount, minimumAmount]);

  const handleCurrencyChanged = useCallback((value: string) => {
    setCurrency(value);
  }, []);

  const handleCustomAmountChanged = useCallback((value: string) => {
    // Custom amount overrides any selected preset amount
    setPresetAmount(undefined);
    setCustomAmount(value);
  }, []);

  const amount = parsedCustomAmount ?? presetAmount;
  const isContinueEnabled = currency != null && amount != null;

  const handleContinueClicked = useCallback(() => {
    if (!isContinueEnabled) {
      return;
    }

    onSubmit({ amount, currency });
  }, [amount, currency, isContinueEnabled, onSubmit]);

  return (
    <div>
      <Select
        id="currency"
        options={currencyOptionsForSelect}
        onChange={handleCurrencyChanged}
        value={currency}
      />
      <div>
        {presetAmountOptions.map(value => (
          <Button
            key={value}
            onClick={() => {
              setCustomAmount(undefined);
              setPresetAmount(value);
            }}
            variant={
              presetAmount === value
                ? ButtonVariant.SecondaryAffirmative
                : ButtonVariant.Secondary
            }
          >
            {toHumanCurrencyString({ amount: value, currency })}
          </Button>
        ))}
      </div>
      <label htmlFor="customAmount">Custom Amount</label>
      <div>
        <Input
          id="customAmount"
          i18n={i18n}
          onChange={handleCustomAmountChanged}
          placeholder="Enter Custom Amount"
          value={customAmount}
        />
        <span>{currency.toUpperCase()}</span>
      </div>
      {error && <div>Error: {error}</div>}
      <Button
        disabled={!isContinueEnabled}
        onClick={handleContinueClicked}
        variant={ButtonVariant.Primary}
      >
        Continue
      </Button>
    </div>
  );
}
