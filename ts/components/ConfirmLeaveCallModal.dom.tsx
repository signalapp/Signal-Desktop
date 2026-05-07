// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import type {
  StartCallingLobbyType,
  StartCallLinkLobbyByRoomIdType,
  StartCallLinkLobbyType,
} from '../state/ducks/calling.preload.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

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
    <AxoConfirmDialog.Root
      open
      onOpenChange={() => toggleConfirmLeaveCallModal(null)}
      title={i18n('icu:CallsList__LeaveCallDialogTitle')}
      description={i18n('icu:CallsList__LeaveCallDialogBody')}
    >
      <AxoConfirmDialog.Cancel />
      <AxoConfirmDialog.Action
        variant="primary"
        onClick={() => leaveCurrentCallAndStartCallingLobby(data)}
      >
        {i18n('icu:CallsList__LeaveCallDialogButton--leave')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}
