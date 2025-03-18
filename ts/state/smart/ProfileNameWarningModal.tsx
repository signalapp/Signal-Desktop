// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user';
import { getGlobalModalsState } from '../selectors/globalModals';
import { useGlobalModalActions } from '../ducks/globalModals';
import { ProfileNameWarningModal } from '../../components/conversation/ProfileNameWarningModal';

export const SmartProfileNameWarningModal = memo(
  function SmartProfileNameWarningModal() {
    const i18n = useSelector(getIntl);
    const globalModals = useSelector(getGlobalModalsState);
    const { profileNameWarningModalConversationType } = globalModals;
    const { toggleProfileNameWarningModal } = useGlobalModalActions();

    if (
      !profileNameWarningModalConversationType ||
      (profileNameWarningModalConversationType !== 'group' &&
        profileNameWarningModalConversationType !== 'direct')
    ) {
      return null;
    }

    return (
      <ProfileNameWarningModal
        conversationType={profileNameWarningModalConversationType}
        i18n={i18n}
        onClose={toggleProfileNameWarningModal}
      />
    );
  }
);
