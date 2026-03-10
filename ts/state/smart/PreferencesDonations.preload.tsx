// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';

import type { MutableRefObject } from 'react';

import {
  getIntl,
  getTheme,
  getUserNumber,
  getVersion,
} from '../selectors/user.std.js';
import { getMe } from '../selectors/conversations.dom.js';
import { PreferencesDonations } from '../../components/PreferencesDonations.dom.js';
import type { SettingsLocation } from '../../types/Nav.std.js';
import { useDonationsActions } from '../ducks/donations.preload.js';
import type { StateType } from '../reducer.preload.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { generateDonationReceiptBlob } from '../../util/generateDonationReceipt.dom.js';
import { useToastActions } from '../ducks/toast.preload.js';
import {
  getCachedSubscriptionConfiguration,
  maybeHydrateDonationConfigCache,
} from '../../util/subscriptionConfiguration.preload.js';
import { drop } from '../../util/drop.std.js';
import { saveAttachmentToDisk } from '../../util/migrations.preload.js';
import {
  ONE_TIME_DONATION_CONFIG_ID,
  BOOST_ID,
} from '../../types/Donations.std.js';
import { phoneNumberToCurrencyCode } from '../../services/donations.preload.js';
import {
  getPreferredBadgeSelector,
  getBadgesById,
} from '../selectors/badges.preload.js';
import { parseBoostBadgeListFromServer } from '../../badges/parseBadgesFromServer.std.js';
import { createLogger } from '../../logging/log.std.js';
import { useBadgesActions } from '../ducks/badges.preload.js';
import { getNetworkIsOnline } from '../selectors/network.preload.js';
import { getItems } from '../selectors/items.dom.js';
import { isFeaturedEnabledSelector } from '../../util/isFeatureEnabled.dom.js';
import {
  getDonationConfigCache,
  getDonationsState,
} from '../selectors/donations.std.js';

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
    const getPreferredBadge = useSelector(getPreferredBadgeSelector);

    const isOnline = useSelector(getNetworkIsOnline);
    const i18n = useSelector(getIntl);
    const items = useSelector(getItems);
    const theme = useSelector(getTheme);

    const donationsState = useSelector(getDonationsState);
    const donationAmountsConfig = useSelector(getDonationConfigCache);
    const validCurrencies = useMemo(
      () => (donationAmountsConfig ? Object.keys(donationAmountsConfig) : []),
      [donationAmountsConfig]
    );

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

    const version = useSelector(getVersion);

    const isDonationPaypalEnabled = isFeaturedEnabledSelector({
      currentVersion: version,
      remoteConfig: items.remoteConfig,
      betaKey: 'desktop.donationPaypal.beta',
      prodKey: 'desktop.donationPaypal.prod',
    });

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
      drop(maybeHydrateDonationConfigCache());
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
        isDonationPaypalEnabled={isDonationPaypalEnabled}
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
