// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { MutableRefObject, ReactNode } from 'react';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';
import type { LocalizerType } from '../types/Util';
import { useConfirmDiscard } from '../hooks/useConfirmDiscard';
import { Button, ButtonVariant } from './Button';
import type {
  CardDetail,
  DonationErrorType,
  HumanDonationAmount,
} from '../types/Donations';
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
import { I18n } from './I18n';
import { strictAssert } from '../util/assert';
import { DonationsOfflineTooltip } from './conversation/DonationsOfflineTooltip';
import { DonateInputAmount } from './preferences/donations/DonateInputAmount';

const SUPPORT_URL = 'https://support.signal.org/hc/requests/new?desktop';

export type PropsDataType = {
  i18n: LocalizerType;
  initialCurrency: string;
  isOnline: boolean;
  donationAmountsConfig: OneTimeDonationHumanAmounts | undefined;
  lastError: DonationErrorType | undefined;
  validCurrencies: ReadonlyArray<string>;
  workflow: DonationWorkflow | undefined;
  renderDonationHero: () => JSX.Element;
};

type PropsHousekeepingType = {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
};

type PropsActionType = {
  clearWorkflow: () => void;
  showPrivacyModal: () => void;
  submitDonation: (payload: SubmitDonationType) => void;
  onBack: () => void;
};

export type PropsType = PropsDataType & PropsActionType & PropsHousekeepingType;

export function PreferencesDonateFlow({
  contentsRef,
  i18n,
  initialCurrency,
  isOnline,
  donationAmountsConfig,
  lastError,
  validCurrencies,
  workflow,
  clearWorkflow,
  renderDonationHero,
  showPrivacyModal,
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
  const [currency, setCurrency] = useState<string>(initialCurrency);
  const [isCardFormDisabled, setIsCardFormDisabled] = useState(false);
  const [cardFormValues, setCardFormValues] = useState<
    CardFormValues | undefined
  >();

  // When changing currency, clear out the last selected amount
  const handleAmountPickerCurrencyChanged = useCallback((value: string) => {
    setAmount(undefined);
    setCurrency(value);
  }, []);

  const handleAmountPickerResult = useCallback((result: AmountPickerResult) => {
    const { currency: pickedCurrency, amount: pickedAmount } = result;
    setAmount(pickedAmount);
    setCurrency(pickedCurrency);
    setStep('paymentDetails');
  }, []);

  const handleCardFormChanged = useCallback((values: CardFormValues) => {
    setCardFormValues(values);
  }, []);

  const handleSubmitDonation = useCallback(
    (cardDetail: CardDetail) => {
      if (amount == null || currency == null) {
        return;
      }

      const paymentAmount = toStripeDonationAmount({ amount, currency });

      setIsCardFormDisabled(true);
      submitDonation({
        currencyType: currency,
        paymentAmount,
        paymentDetail: cardDetail,
      });
    },
    [amount, currency, setIsCardFormDisabled, submitDonation]
  );

  useEffect(() => {
    if (!workflow || lastError) {
      setIsCardFormDisabled(false);
    }
  }, [lastError, setIsCardFormDisabled, workflow]);

  const onTryClose = useCallback(() => {
    const onDiscard = () => {
      clearWorkflow();
    };
    const isConfirmationNeeded = Boolean(
      step === 'paymentDetails' &&
        !isCardFormDisabled &&
        workflow?.type !== 'DONE'
    );

    confirmDiscardIf(isConfirmationNeeded, onDiscard);
  }, [clearWorkflow, confirmDiscardIf, isCardFormDisabled, step, workflow]);
  tryClose.current = onTryClose;

  let innerContent: JSX.Element;
  let handleBack: () => void;

  if (step === 'amount') {
    innerContent = (
      <>
        {renderDonationHero()}
        <AmountPicker
          i18n={i18n}
          initialAmount={amount}
          initialCurrency={currency}
          isOnline={isOnline}
          donationAmountsConfig={donationAmountsConfig}
          validCurrencies={validCurrencies}
          onChangeCurrency={handleAmountPickerCurrencyChanged}
          onSubmit={handleAmountPickerResult}
        />
        <HelpFooter i18n={i18n} showOneTimeOnlyNotice />
      </>
    );
    // Dismiss DonateFlow and return to Donations home
    handleBack = () => onBack();
  } else {
    strictAssert(amount, 'Amount is required for payment card form');
    innerContent = (
      <>
        <CardFormHero i18n={i18n} amount={amount} currency={currency} />
        <hr className="PreferencesDonations__separator PreferencesDonations__separator--card-form" />
        <CardForm
          amount={amount}
          currency={currency}
          disabled={isCardFormDisabled}
          i18n={i18n}
          initialValues={cardFormValues}
          isOnline={isOnline}
          onChange={handleCardFormChanged}
          onSubmit={handleSubmitDonation}
          showPrivacyModal={showPrivacyModal}
        />
        <HelpFooter i18n={i18n} />
      </>
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
    <div className="PreferencesDonations DonationForm">
      {confirmDiscardModal}
      {innerContent}
    </div>
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
  isOnline: boolean;
  donationAmountsConfig: OneTimeDonationHumanAmounts | undefined;
  validCurrencies: ReadonlyArray<string>;
  onChangeCurrency: (value: string) => void;
  onSubmit: (result: AmountPickerResult) => void;
};

function AmountPicker({
  donationAmountsConfig,
  i18n,
  initialAmount,
  initialCurrency = 'usd',
  isOnline,
  validCurrencies,
  onChangeCurrency,
  onSubmit,
}: AmountPickerProps): JSX.Element {
  const [currency, setCurrency] = useState(initialCurrency);

  const [presetAmount, setPresetAmount] = useState<
    HumanDonationAmount | undefined
  >();
  const [customAmount, setCustomAmount] = useState<string>(
    initialAmount?.toString() ?? ''
  );

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
    if (
      initialAmount &&
      presetAmountOptions.find(option => option === initialAmount)
    ) {
      setPresetAmount(initialAmount);
      setCustomAmount('');
    } else {
      setPresetAmount(undefined);
      setCustomAmount(initialAmount?.toString() ?? '');
    }
  }, [initialAmount, presetAmountOptions]);

  const minimumAmount = useMemo<HumanDonationAmount>(() => {
    if (!donationAmountsConfig || !donationAmountsConfig[currency]) {
      return brandHumanDonationAmount(0);
    }

    const currencyAmounts = donationAmountsConfig[currency];
    return currencyAmounts.minimum;
  }, [donationAmountsConfig, currency]);

  const currencyOptionsForSelect = useMemo(() => {
    return validCurrencies.toSorted().map((currencyString: string) => {
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

  const handleCurrencyChanged = useCallback(
    (value: string) => {
      setCurrency(value);
      setCustomAmount('');
      onChangeCurrency(value);
    },
    [onChangeCurrency]
  );

  const handleCustomAmountChanged = useCallback((value: string) => {
    // Custom amount overrides any selected preset amount
    setPresetAmount(undefined);
    setCustomAmount(value);
  }, []);

  const amount = parsedCustomAmount ?? presetAmount;
  const isContinueEnabled = isOnline && currency != null && amount != null;

  const handleContinueClicked = useCallback(() => {
    if (!isContinueEnabled) {
      return;
    }

    onSubmit({ amount, currency });
  }, [amount, currency, isContinueEnabled, onSubmit]);

  let customInputClassName;
  if (error) {
    customInputClassName = 'DonationAmountPicker__CustomInput--with-error';
  } else if (parsedCustomAmount) {
    customInputClassName = 'DonationAmountPicker__CustomInput--selected';
  } else {
    customInputClassName = 'DonationAmountPicker__CustomInput';
  }

  const continueButton = (
    <Button
      className="PreferencesDonations__PrimaryButton"
      disabled={!isContinueEnabled}
      onClick={handleContinueClicked}
      variant={isOnline ? ButtonVariant.Primary : ButtonVariant.Secondary}
    >
      Continue
    </Button>
  );

  return (
    <div className="DonationAmountPicker">
      <Select
        moduleClassName="DonationForm__CurrencySelect"
        id="currency"
        options={currencyOptionsForSelect}
        onChange={handleCurrencyChanged}
        value={currency}
      />
      <div className="PreferencesDonations__section-header PreferencesDonations__section-header--donate-flow">
        {i18n('icu:DonateFlow__make-a-one-time-donation')}
      </div>
      <div className="DonationAmountPicker__AmountOptions">
        {presetAmountOptions.map(value => (
          <button
            className={classNames({
              DonationAmountPicker__PresetButton: true,
              'DonationAmountPicker__PresetButton--selected':
                presetAmount === value,
            })}
            key={value}
            onClick={() => {
              setCustomAmount('');
              setPresetAmount(value);
            }}
            type="button"
          >
            {toHumanCurrencyString({ amount: value, currency })}
          </button>
        ))}
        <DonateInputAmount
          className={customInputClassName}
          currency={currency}
          id="customAmount"
          onValueChange={handleCustomAmountChanged}
          onFocus={() => setPresetAmount(undefined)}
          placeholder={i18n(
            'icu:DonateFlow__amount-picker-custom-amount-placeholder'
          )}
          value={customAmount}
        />
      </div>
      <div className="DonationAmountPicker__PrimaryButtonContainer">
        {isOnline ? (
          continueButton
        ) : (
          <DonationsOfflineTooltip i18n={i18n}>
            {continueButton}
          </DonationsOfflineTooltip>
        )}
      </div>
    </div>
  );
}

type CardFormValues = {
  cardExpiration: string | undefined;
  cardNumber: string | undefined;
  cardCvc: string | undefined;
};

type CardFormProps = {
  amount: HumanDonationAmount;
  currency: string;
  disabled: boolean;
  i18n: LocalizerType;
  initialValues: CardFormValues | undefined;
  isOnline: boolean;
  onChange: (values: CardFormValues) => void;
  onSubmit: (cardDetail: CardDetail) => void;
  showPrivacyModal: () => void;
};

function CardForm({
  amount,
  currency,
  disabled,
  i18n,
  initialValues,
  isOnline,
  onChange,
  onSubmit,
  showPrivacyModal,
}: CardFormProps): JSX.Element {
  const [cardExpiration, setCardExpiration] = useState(
    initialValues?.cardExpiration ?? ''
  );
  const [cardNumber, setCardNumber] = useState(initialValues?.cardNumber ?? '');
  const [cardCvc, setCardCvc] = useState(initialValues?.cardCvc ?? '');

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

  useEffect(() => {
    onChange({ cardExpiration, cardNumber, cardCvc });
  }, [cardExpiration, cardNumber, cardCvc, onChange]);

  const privacyLearnMoreLink = useCallback(
    (parts: ReactNode): JSX.Element => {
      return (
        <button
          type="button"
          className="PreferencesDonations__description__read-more"
          onClick={showPrivacyModal}
        >
          {parts}
        </button>
      );
    },
    [showPrivacyModal]
  );

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

  const handleDonateClicked = useCallback(() => {
    const formResult = parseCardForm({ cardNumber, cardExpiration, cardCvc });

    setCardNumberError(formResult.cardNumber.error ?? null);
    setCardExpirationError(formResult.cardExpiration.error ?? null);
    setCardCvcError(formResult.cardCvc.error ?? null);

    const cardDetail = cardFormToCardDetail(formResult);
    if (cardDetail == null) {
      return;
    }

    onSubmit(cardDetail);
  }, [cardCvc, cardExpiration, cardNumber, onSubmit]);

  const isDonateDisabled =
    disabled ||
    !isOnline ||
    cardNumber === '' ||
    cardExpiration === '' ||
    cardCvc === '' ||
    cardNumberError != null ||
    cardExpirationError != null ||
    cardCvcError != null;

  const donateButton = (
    <Button
      className="PreferencesDonations__PrimaryButton"
      disabled={isDonateDisabled}
      onClick={handleDonateClicked}
      variant={isOnline ? ButtonVariant.Primary : ButtonVariant.Secondary}
    >
      {i18n('icu:PreferencesDonations__donate-button-with-amount', {
        formattedCurrencyAmount,
      })}
    </Button>
  );

  return (
    <div className="DonationCardForm">
      <div className="DonationCardForm__Header--Info PreferencesDonations__section-header">
        {i18n('icu:DonateFlow__credit-or-debit-card')}
      </div>
      <div className="DonationCardForm__Info">
        <I18n
          components={{
            learnMoreLink: privacyLearnMoreLink,
          }}
          i18n={i18n}
          id="icu:DonateFlow__card-form-instructions"
        />
      </div>
      <div className="DonationCardForm_Field DonationCardForm_CardNumberField">
        <label className="DonationCardForm_Label" htmlFor="cardNumber">
          {i18n('icu:DonateFlow__card-form-card-number')}
        </label>
        <div
          className={classNames({
            'DonationCardForm_InputContainer--with-error':
              cardNumberError != null,
          })}
        >
          <DonateInputCardNumber
            id="cardNumber"
            value={cardNumber}
            onValueChange={handleCardNumberChange}
            maxInputLength={cardFormSettings.cardNumber.maxInputLength}
            onBlur={handleCardNumberBlur}
          />
          {cardNumberError != null && (
            <div className="DonationCardForm_FieldError">
              {getCardNumberErrorMessage(i18n, cardNumberError)}
            </div>
          )}
        </div>
      </div>
      <div className="DonationCardForm_Field DonationCardForm_CardExpirationField">
        <label className="DonationCardForm_Label" htmlFor="cardExpiration">
          {i18n('icu:DonateFlow__card-form-expiration-date')}
        </label>
        <div
          className={classNames({
            'DonationCardForm_InputContainer--with-error':
              cardExpirationError != null,
          })}
        >
          <DonateInputCardExp
            id="cardExpiration"
            value={cardExpiration}
            onValueChange={handleCardExpirationChange}
            onBlur={handleCardExpirationBlur}
          />
          {cardExpirationError && (
            <div className="DonationCardForm_FieldError">
              {getCardExpirationErrorMessage(i18n, cardExpirationError)}
            </div>
          )}
        </div>
      </div>
      <div className="DonationCardForm_Field DonationCardForm_CardCvcField">
        <label className="DonationCardForm_Label" htmlFor="cardCvc">
          {cardFormSettings.cardCvc.label}
        </label>
        <div
          className={classNames({
            'DonationCardForm_InputContainer--with-error': cardCvcError != null,
          })}
        >
          <DonateInputCardCvc
            id="cardCvc"
            value={cardCvc}
            onValueChange={handleCardCvcChange}
            maxInputLength={cardFormSettings.cardCvc.maxInputLength}
            onBlur={handleCardCvcBlur}
          />
          {cardCvcError && (
            <div className="DonationCardForm_FieldError">
              {getCardCvcErrorMessage(i18n, cardCvcError)}
            </div>
          )}
        </div>
      </div>
      <div className="DonationCardForm__PrimaryButtonContainer">
        {isOnline ? (
          donateButton
        ) : (
          <DonationsOfflineTooltip i18n={i18n}>
            {donateButton}
          </DonationsOfflineTooltip>
        )}
      </div>
    </div>
  );
}

type CardFormHeroProps = {
  amount: HumanDonationAmount;
  currency: string;
  i18n: LocalizerType;
};

// Similar to <DonationHero> or renderDonationHero
function CardFormHero({
  amount,
  currency,
  i18n,
}: CardFormHeroProps): JSX.Element {
  const formattedCurrencyAmount = useMemo<string>(() => {
    return toHumanCurrencyString({ amount, currency });
  }, [amount, currency]);

  return (
    <>
      <div className="PreferencesDonations__avatar">
        <div className="DonationCardFormHero__Badge" />
      </div>
      <div className="PreferencesDonations__title">
        {i18n('icu:DonateFlow__card-form-title-donate-with-amount', {
          formattedCurrencyAmount,
        })}
      </div>
      <div className="PreferencesDonations__description">
        {i18n('icu:DonateFlow__one-time-donation-boost-badge-info')}
      </div>
    </>
  );
}

type HelpFooterProps = {
  i18n: LocalizerType;
  showOneTimeOnlyNotice?: boolean;
};

function HelpFooter({
  i18n,
  showOneTimeOnlyNotice,
}: HelpFooterProps): JSX.Element {
  const contactSupportLink = (parts: Array<string | JSX.Element>) => (
    <a
      className="DonationFormHelpFooter__ContactSupportLink"
      href={SUPPORT_URL}
      rel="noreferrer"
      target="_blank"
    >
      {parts}
    </a>
  );

  return (
    <div className="DonationForm__HelpFooter">
      {showOneTimeOnlyNotice && (
        <div className="DonationForm__HelpFooterDesktopOneTimeOnlyNotice">
          {i18n('icu:DonateFlow__desktop-one-time-only-notice')}
        </div>
      )}
      <I18n
        id="icu:DonateFlow__having-issues-contact-support"
        i18n={i18n}
        components={{
          contactSupportLink,
        }}
      />
    </div>
  );
}
