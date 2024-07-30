// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { UsernameOnboardingModal } from '../../components/UsernameOnboardingModal';
import { EditState } from '../../components/ProfileEditor';
import { getIntl } from '../selectors/user';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useUsernameActions } from '../ducks/username';

export const SmartUsernameOnboardingModal = memo(
  function SmartUsernameOnboardingModal(): JSX.Element {
    const i18n = useSelector(getIntl);
    const { toggleProfileEditor, toggleUsernameOnboarding } =
      useGlobalModalActions();
    const { openUsernameReservationModal } = useUsernameActions();

    const onNext = useCallback(async () => {
      await window.storage.put('hasCompletedUsernameOnboarding', true);
      openUsernameReservationModal();
      toggleProfileEditor(EditState.Username);
      toggleUsernameOnboarding();
    }, [
      toggleProfileEditor,
      toggleUsernameOnboarding,
      openUsernameReservationModal,
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
