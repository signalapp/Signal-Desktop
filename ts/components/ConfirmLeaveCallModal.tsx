// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { ConfirmationDialog } from './ConfirmationDialog';

import type { LocalizerType } from '../types/Util';
import type {
  StartCallingLobbyType,
  StartCallLinkLobbyByRoomIdType,
  StartCallLinkLobbyType,
} from '../state/ducks/calling';

export type StartCallData =
  | ({
      type: 'conversation';
    } & StartCallingLobbyType)
  | ({ type: 'adhoc-roomId' } & StartCallLinkLobbyByRoomIdType)
  | ({ type: 'adhoc-rootKey' } & StartCallLinkLobbyType);
type HousekeepingProps = {
  i18n: LocalizerType;
};
type DispatchProps = {
  toggleConfirmLeaveCallModal: (options: StartCallData | null) => void;
  leaveCurrentCallAndStartCallingLobby: (options: StartCallData) => void;
};

export type Props = { data: StartCallData } & HousekeepingProps & DispatchProps;

export function ConfirmLeaveCallModal({
  i18n,
  data,
  leaveCurrentCallAndStartCallingLobby,
  toggleConfirmLeaveCallModal,
}: Props): JSX.Element | null {
  return (
    <ConfirmationDialog
      dialogName="GroupCallRemoteParticipant.blockInfo"
      cancelText={i18n('icu:cancel')}
      i18n={i18n}
      onClose={() => {
        toggleConfirmLeaveCallModal(null);
      }}
      title={i18n('icu:CallsList__LeaveCallDialogTitle')}
      actions={[
        {
          text: i18n('icu:CallsList__LeaveCallDialogButton--leave'),
          style: 'affirmative',
          action: () => {
            leaveCurrentCallAndStartCallingLobby(data);
          },
        },
      ]}
    >
      {i18n('icu:CallsList__LeaveCallDialogBody')}
    </ConfirmationDialog>
  );
}
