// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import type { MutableRefObject } from 'react';

import { getIntl } from '../selectors/user';
import { getMe } from '../selectors/conversations';
import { PreferencesDonations } from '../../components/PreferencesDonations';
import type { Page } from '../../components/Preferences';
import { useDonationsActions } from '../ducks/donations';
import type { StateType } from '../reducer';
import { isStagingServer } from '../../util/isStagingServer';
import { generateDonationReceiptBlob } from '../../util/generateDonationReceipt';
import { useToastActions } from '../ducks/toast';
import { getDonationHumanAmounts } from '../../util/subscriptionConfiguration';
import { drop } from '../../util/drop';
import type { OneTimeDonationHumanAmounts } from '../../types/Donations';

export const SmartPreferencesDonations = memo(
  function SmartPreferencesDonations({
    contentsRef,
    page,
    setPage,
  }: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
    page: Page;
    setPage: (page: Page) => void;
  }) {
    const [validCurrencies, setValidCurrencies] = useState<
      ReadonlyArray<string>
    >([]);
    const [donationAmountsConfig, setDonationAmountsConfig] =
      useState<OneTimeDonationHumanAmounts>();

    const isStaging = isStagingServer();
    const i18n = useSelector(getIntl);

    const workflow = useSelector(
      (state: StateType) => state.donations.currentWorkflow
    );
    const { clearWorkflow, submitDonation } = useDonationsActions();

    const {
      avatars: userAvatarData = [],
      color,
      firstName,
      profileAvatarUrl,
    } = useSelector(getMe);
    const { showToast } = useToastActions();
    const donationReceipts = useSelector(
      (state: StateType) => state.donations.receipts
    );
    const { saveAttachmentToDisk } = window.Signal.Migrations;

    // Eagerly load donation config from API when entering Donations Home so the
    // Amount picker loads instantly
    useEffect(() => {
      async function loadDonationAmounts() {
        const amounts = await getDonationHumanAmounts();
        setDonationAmountsConfig(amounts);
        const currencies = Object.keys(amounts);
        setValidCurrencies(currencies);
      }
      drop(loadDonationAmounts());
    }, []);

    return (
      <PreferencesDonations
        i18n={i18n}
        userAvatarData={userAvatarData}
        color={color}
        firstName={firstName}
        profileAvatarUrl={profileAvatarUrl}
        donationReceipts={donationReceipts}
        saveAttachmentToDisk={saveAttachmentToDisk}
        generateDonationReceiptBlob={generateDonationReceiptBlob}
        donationAmountsConfig={donationAmountsConfig}
        validCurrencies={validCurrencies}
        showToast={showToast}
        contentsRef={contentsRef}
        isStaging={isStaging}
        page={page}
        workflow={workflow}
        clearWorkflow={clearWorkflow}
        submitDonation={submitDonation}
        setPage={setPage}
      />
    );
  }
);
