// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useRef, useState } from 'react';

import type { MutableRefObject } from 'react';

import type { LocalizerType } from '../types/Util';
import { useConfirmDiscard } from '../hooks/useConfirmDiscard';
import { PreferencesContent } from './Preferences';
import { Button, ButtonVariant } from './Button';
import type { CardDetail, DonationWorkflow } from '../types/Donations';
import { Input } from './Input';

type PropsExternalType = {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
};

export type PropsDataType = {
  i18n: LocalizerType;
  workflow: DonationWorkflow | undefined;
};

type PropsActionType = {
  clearWorkflow: () => void;
  onBack: () => void;
  submitDonation: (options: {
    currencyType: string;
    paymentAmount: number;
    paymentDetail: CardDetail;
  }) => void;
};

export type PropsType = PropsDataType & PropsActionType & PropsExternalType;

export function PreferencesDonateFlow({
  contentsRef,
  i18n,
  workflow,
  clearWorkflow,
  onBack,
  submitDonation,
}: PropsType): JSX.Element {
  const tryClose = useRef<() => void | undefined>();
  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard({
    i18n,
    name: 'PreferencesDonateFlow',
    tryClose,
  });

  const [amount, setAmount] = useState('10.00');
  const [cardExpirationMonth, setCardExpirationMonth] = useState('');
  const [cardExpirationYear, setCardExpirationYear] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const handleDonateClicked = useCallback(() => {
    const parsedAmount = parseFloat(amount);
    // Note: Whether to multiply by 100 depends on the specific currency
    // e.g. JPY is not multipled by 100
    const paymentAmount = parsedAmount * 100;

    submitDonation({
      currencyType: 'USD',
      paymentAmount,
      paymentDetail: {
        expirationMonth: cardExpirationMonth,
        expirationYear: cardExpirationYear,
        number: cardNumber,
        cvc: cardCvc,
      },
    });
  }, [
    amount,
    cardCvc,
    cardExpirationMonth,
    cardExpirationYear,
    cardNumber,
    submitDonation,
  ]);

  const isDonateDisabled = workflow !== undefined;

  const backButton = (
    <button
      aria-label={i18n('icu:goBack')}
      className="Preferences__back-icon"
      onClick={onBack}
      type="button"
    />
  );

  const onTryClose = useCallback(() => {
    const onDiscard = () => {
      // TODO: DESKTOP-8950
    };

    confirmDiscardIf(true, onDiscard);
  }, [confirmDiscardIf]);
  tryClose.current = onTryClose;

  const content = (
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

      <label htmlFor="amount">Amount (USD)</label>
      <Input
        id="amount"
        i18n={i18n}
        onChange={value => setAmount(value)}
        placeholder="5"
        value={amount}
      />
      <label htmlFor="cardNumber">Card Number</label>
      <Input
        id="cardNumber"
        i18n={i18n}
        onChange={value => setCardNumber(value)}
        placeholder="0000000000000000"
        maxLengthCount={16}
        value={cardNumber}
      />
      <label htmlFor="cardExpirationMonth">Expiration Month</label>
      <Input
        id="cardExpirationMonth"
        i18n={i18n}
        onChange={value => setCardExpirationMonth(value)}
        placeholder="MM"
        value={cardExpirationMonth}
      />
      <label htmlFor="cardExpirationYear">Expiration Year</label>
      <Input
        id="cardExpirationYear"
        i18n={i18n}
        onChange={value => setCardExpirationYear(value)}
        placeholder="YY"
        value={cardExpirationYear}
      />
      <label htmlFor="cardCvc">Cvc</label>
      <Input
        id="cardCvc"
        i18n={i18n}
        onChange={value => setCardCvc(value)}
        placeholder="123"
        value={cardCvc}
      />
      <Button
        disabled={isDonateDisabled}
        onClick={handleDonateClicked}
        variant={ButtonVariant.Primary}
      >
        Donate $10
      </Button>
    </div>
  );

  return (
    <>
      {confirmDiscardModal}

      <PreferencesContent
        backButton={backButton}
        contents={content}
        contentsRef={contentsRef}
        title={i18n('icu:Preferences__DonateTitle')}
      />
    </>
  );
}
