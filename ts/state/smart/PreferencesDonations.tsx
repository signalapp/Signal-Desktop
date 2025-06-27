// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';

import type { MutableRefObject } from 'react';

import { getIntl } from '../selectors/user';
import { PreferencesDonations } from '../../components/PreferencesDonations';
import type { Page } from '../../components/Preferences';
import { useDonationsActions } from '../ducks/donations';
import type { StateType } from '../reducer';
import { isStagingServer } from '../../util/isStagingServer';

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

    return (
      <PreferencesDonations
        contentsRef={contentsRef}
        i18n={i18n}
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
