// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { MutableRefObject } from 'react';

import type { LocalizerType } from '../types/Util';
import { Page, PreferencesContent } from './Preferences';
import { Button, ButtonVariant } from './Button';
import { PreferencesDonateFlow } from './PreferencesDonateFlow';
import type { CardDetail, DonationWorkflow } from '../types/Donations';

type PropsExternalType = {
  contentsRef: MutableRefObject<HTMLDivElement | null>;
};

export type PropsDataType = {
  i18n: LocalizerType;
  isStaging: boolean;
  page: Page;
  workflow: DonationWorkflow | undefined;
};

type PropsActionType = {
  clearWorkflow: () => void;
  setPage: (page: Page) => void;
  submitDonation: (options: {
    currencyType: string;
    paymentAmount: number;
    paymentDetail: CardDetail;
  }) => void;
};

export type PropsType = PropsDataType & PropsActionType & PropsExternalType;

export function PreferencesDonations({
  contentsRef,
  i18n,
  isStaging,
  page,
  workflow,
  clearWorkflow,
  setPage,
  submitDonation,
}: PropsType): JSX.Element {
  if (page === Page.DonationsDonateFlow) {
    return (
      <PreferencesDonateFlow
        contentsRef={contentsRef}
        i18n={i18n}
        workflow={workflow}
        clearWorkflow={clearWorkflow}
        onBack={() => setPage(Page.Donations)}
        submitDonation={submitDonation}
      />
    );
  }

  const content = (
    <div className="PreferencesDonations">
      {isStaging && (
        <Button
          onClick={() => setPage(Page.DonationsDonateFlow)}
          variant={ButtonVariant.Primary}
        >
          Donate
        </Button>
      )}
    </div>
  );

  return (
    <PreferencesContent
      contents={content}
      contentsRef={contentsRef}
      title={i18n('icu:Preferences__DonateTitle')}
    />
  );
}
