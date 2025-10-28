// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user.std.js';
import { getGlobalModalsState } from '../selectors/globalModals.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { ProfileNameWarningModal } from '../../components/conversation/ProfileNameWarningModal.dom.js';

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
