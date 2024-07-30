// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import { useCallingActions } from '../ducks/calling';
import { getIntl } from '../selectors/user';
import { useGlobalModalActions } from '../ducks/globalModals';
import { getConfirmLeaveCallModalState } from '../selectors/globalModals';
import { ConfirmLeaveCallModal } from '../../components/ConfirmLeaveCallModal';

export const SmartConfirmLeaveCallModal = memo(
  function SmartConfirmLeaveCallModal(): JSX.Element | null {
    const i18n = useSelector(getIntl);
    const confirmLeaveCallModalState = useSelector(
      getConfirmLeaveCallModalState
    );

    const { leaveCurrentCallAndStartCallingLobby } = useCallingActions();
    const { toggleConfirmLeaveCallModal } = useGlobalModalActions();

    if (!confirmLeaveCallModalState) {
      return null;
    }

    return (
      <ConfirmLeaveCallModal
        i18n={i18n}
        data={confirmLeaveCallModalState}
        leaveCurrentCallAndStartCallingLobby={
          leaveCurrentCallAndStartCallingLobby
        }
        toggleConfirmLeaveCallModal={toggleConfirmLeaveCallModal}
      />
    );
  }
);
