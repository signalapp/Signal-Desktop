// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import type { MutableRefObject } from 'react';

import { getIntl, getTheme, getUserNumber } from '../selectors/user';
import { getMe } from '../selectors/conversations';
import { PreferencesDonations } from '../../components/PreferencesDonations';
import type { SettingsPage } from '../../types/Nav';
import { useDonationsActions } from '../ducks/donations';
import type { StateType } from '../reducer';
import { isStagingServer } from '../../util/isStagingServer';
import { generateDonationReceiptBlob } from '../../util/generateDonationReceipt';
import { useToastActions } from '../ducks/toast';
import { getDonationHumanAmounts } from '../../util/subscriptionConfiguration';
import { drop } from '../../util/drop';
import type { OneTimeDonationHumanAmounts } from '../../types/Donations';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { phoneNumberToCurrencyCode } from '../../services/donations';
import { getNetworkIsOnline } from '../selectors/network';

export const SmartPreferencesDonations = memo(
  function SmartPreferencesDonations({
    contentsRef,
    page,
    setPage,
  }: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
    page: SettingsPage;
    setPage: (page: SettingsPage) => void;
  }) {
    const [validCurrencies, setValidCurrencies] = useState<
      ReadonlyArray<string>
    >([]);
    const [donationAmountsConfig, setDonationAmountsConfig] =
      useState<OneTimeDonationHumanAmounts>();

    const getPreferredBadge = useSelector(getPreferredBadgeSelector);

    const isOnline = useSelector(getNetworkIsOnline);
    const isStaging = isStagingServer();
    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);

    const donationsState = useSelector((state: StateType) => state.donations);
    const { clearWorkflow, resumeWorkflow, submitDonation, updateLastError } =
      useDonationsActions();

    const ourNumber = useSelector(getUserNumber);
    const { badges, color, firstName, profileAvatarUrl } = useSelector(getMe);
    const badge = getPreferredBadge(badges);

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

    const currencyFromPhone = ourNumber
      ? phoneNumberToCurrencyCode(ourNumber).toLowerCase()
      : 'usd';
    const initialCurrency = validCurrencies.includes(currencyFromPhone)
      ? currencyFromPhone
      : 'usd';

    return (
      <PreferencesDonations
        i18n={i18n}
        badge={badge}
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
        initialCurrency={initialCurrency}
        isOnline={isOnline}
        isStaging={isStaging}
        page={page}
        didResumeWorkflowAtStartup={donationsState.didResumeWorkflowAtStartup}
        lastError={donationsState.lastError}
        workflow={donationsState.currentWorkflow}
        clearWorkflow={clearWorkflow}
        resumeWorkflow={resumeWorkflow}
        updateLastError={updateLastError}
        submitDonation={submitDonation}
        setPage={setPage}
        theme={theme}
      />
    );
  }
);
