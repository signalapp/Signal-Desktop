// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { UsernameOnboardingModal } from '../../components/UsernameOnboardingModal';
import { getIntl } from '../selectors/user';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useUsernameActions } from '../ducks/username';
import { useNavActions } from '../ducks/nav';
import { NavTab, SettingsPage, ProfileEditorPage } from '../../types/Nav';

export const SmartUsernameOnboardingModal = memo(
  function SmartUsernameOnboardingModal(): JSX.Element {
    const i18n = useSelector(getIntl);
    const { toggleUsernameOnboarding } = useGlobalModalActions();
    const { openUsernameReservationModal } = useUsernameActions();
    const { changeLocation } = useNavActions();

    const onNext = useCallback(async () => {
      await window.storage.put('hasCompletedUsernameOnboarding', true);
      openUsernameReservationModal();
      changeLocation({
        tab: NavTab.Settings,
        details: {
          page: SettingsPage.Profile,
          state: ProfileEditorPage.Username,
        },
      });
      toggleUsernameOnboarding();
    }, [
      changeLocation,
      openUsernameReservationModal,
      toggleUsernameOnboarding,
    ]);

    const onSkip = useCallback(async () => {
      await window.storage.put('hasCompletedUsernameOnboarding', true);
      toggleUsernameOnboarding();
    }, [toggleUsernameOnboarding]);

    return (
      <UsernameOnboardingModal
        i18n={i18n}
        onNext={onNext}
        onSkip={onSkip}
        onClose={toggleUsernameOnboarding}
      />
    );
  }
);
