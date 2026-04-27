// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { UsernameOnboardingModal } from '../../components/UsernameOnboardingModal.dom.tsx';
import { getIntl } from '../selectors/user.std.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useUsernameActions } from '../ducks/username.preload.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import {
  NavTab,
  SettingsPage,
  ProfileEditorPage,
} from '../../types/Nav.std.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';

export const SmartUsernameOnboardingModal = memo(
  function SmartUsernameOnboardingModal(): React.JSX.Element {
    const i18n = useSelector(getIntl);
    const { toggleUsernameOnboarding } = useGlobalModalActions();
    const { openUsernameReservationModal } = useUsernameActions();
    const { changeLocation } = useNavActions();

    const onNext = useCallback(async () => {
      await itemStorage.put('hasCompletedUsernameOnboarding', true);
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
      await itemStorage.put('hasCompletedUsernameOnboarding', true);
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
