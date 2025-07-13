// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
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
