// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';

import type { MutableRefObject } from 'react';

import { getIntl, getTheme, getUserNumber } from '../selectors/user.js';
import { getMe } from '../selectors/conversations.js';
import { PreferencesDonations } from '../../components/PreferencesDonations.js';
import type { SettingsLocation } from '../../types/Nav.js';
import { useDonationsActions } from '../ducks/donations.js';
import type { StateType } from '../reducer.js';
import { useConversationsActions } from '../ducks/conversations.js';
import { generateDonationReceiptBlob } from '../../util/generateDonationReceipt.js';
import { useToastActions } from '../ducks/toast.js';
import {
  getDonationHumanAmounts,
  getCachedSubscriptionConfiguration,
} from '../../util/subscriptionConfiguration.js';
import { drop } from '../../util/drop.js';
import { saveAttachmentToDisk } from '../../util/migrations.js';
import type { OneTimeDonationHumanAmounts } from '../../types/Donations.js';
import {
  ONE_TIME_DONATION_CONFIG_ID,
  BOOST_ID,
} from '../../types/Donations.js';
import { phoneNumberToCurrencyCode } from '../../services/donations.js';
import {
  getPreferredBadgeSelector,
  getBadgesById,
} from '../selectors/badges.js';
import { parseBoostBadgeListFromServer } from '../../badges/parseBadgesFromServer.js';
import { createLogger } from '../../logging/log.js';
import { useBadgesActions } from '../ducks/badges.js';
import { getNetworkIsOnline } from '../selectors/network.js';

const log = createLogger('SmartPreferencesDonations');

export const SmartPreferencesDonations = memo(
  function SmartPreferencesDonations({
    contentsRef,
    settingsLocation,
    setSettingsLocation,
  }: {
    contentsRef: MutableRefObject<HTMLDivElement | null>;
    settingsLocation: SettingsLocation;
    setSettingsLocation: (settingsLocation: SettingsLocation) => void;
  }) {
    const [validCurrencies, setValidCurrencies] = useState<
      ReadonlyArray<string>
    >([]);
    const [donationAmountsConfig, setDonationAmountsConfig] =
      useState<OneTimeDonationHumanAmounts>();

    const getPreferredBadge = useSelector(getPreferredBadgeSelector);

    const isOnline = useSelector(getNetworkIsOnline);
    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);

    const donationsState = useSelector((state: StateType) => state.donations);
    const {
      applyDonationBadge,
      clearWorkflow,
      resumeWorkflow,
      submitDonation,
      updateLastError,
    } = useDonationsActions();
    const { myProfileChanged } = useConversationsActions();

    const badgesById = useSelector(getBadgesById);
    const ourNumber = useSelector(getUserNumber);
    const me = useSelector(getMe);
    const { badges, color, firstName, profileAvatarUrl } = me;
    const badge = getPreferredBadge(badges);

    const { showToast } = useToastActions();
    const donationReceipts = useSelector(
      (state: StateType) => state.donations.receipts
    );

    const { updateOrCreate } = useBadgesActions();

    // Function to fetch donation badge data
    const fetchBadgeData = useCallback(async () => {
      try {
        const subscriptionConfig = await getCachedSubscriptionConfiguration();
        const badgeData = parseBoostBadgeListFromServer(
          subscriptionConfig,
          window.SignalContext.config.updatesUrl
        );

        const boostBadge = badgeData[ONE_TIME_DONATION_CONFIG_ID];
        if (boostBadge) {
          updateOrCreate([boostBadge]);
          return boostBadge;
        }
      } catch (error) {
        log.warn('Failed to load donation badge:', error);
      }
      return undefined;
    }, [updateOrCreate]);

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
    // Load badge data on mount
    useEffect(() => {
      drop(fetchBadgeData());
    }, [fetchBadgeData]);

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
        settingsLocation={settingsLocation}
        didResumeWorkflowAtStartup={donationsState.didResumeWorkflowAtStartup}
        lastError={donationsState.lastError}
        workflow={donationsState.currentWorkflow}
        applyDonationBadge={applyDonationBadge}
        clearWorkflow={clearWorkflow}
        resumeWorkflow={resumeWorkflow}
        updateLastError={updateLastError}
        submitDonation={submitDonation}
        setSettingsLocation={setSettingsLocation}
        theme={theme}
        donationBadge={badgesById[BOOST_ID] ?? undefined}
        fetchBadgeData={fetchBadgeData}
        me={me}
        myProfileChanged={myProfileChanged}
      />
    );
  }
);
