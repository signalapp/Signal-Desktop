// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { CallHistoryGroup } from '../../types/CallDisposition';
import { getIntl } from '../selectors/user';
import { CallLinkDetails } from '../../components/CallLinkDetails';
import { getCallLinkSelector } from '../selectors/calling';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useCallingActions } from '../ducks/calling';
import * as log from '../../logging/log';
import { strictAssert } from '../../util/assert';

export type SmartCallLinkDetailsProps = Readonly<{
  roomId: string;
  callHistoryGroup: CallHistoryGroup;
}>;

export const SmartCallLinkDetails = memo(function SmartCallLinkDetails({
  roomId,
  callHistoryGroup,
}: SmartCallLinkDetailsProps) {
  const i18n = useSelector(getIntl);
  const callLinkSelector = useSelector(getCallLinkSelector);
  const { startCallLinkLobby } = useCallingActions();
  const { showShareCallLinkViaSignal } = useGlobalModalActions();

  const callLink = callLinkSelector(roomId);

  const handleShareCallLinkViaSignal = useCallback(() => {
    strictAssert(callLink != null, 'callLink not found');
    showShareCallLinkViaSignal(callLink, i18n);
  }, [callLink, i18n, showShareCallLinkViaSignal]);

  const handleStartCallLinkLobby = useCallback(() => {
    strictAssert(callLink != null, 'callLink not found');
    startCallLinkLobby({ rootKey: callLink.rootKey });
  }, [callLink, startCallLinkLobby]);

  if (callLink == null) {
    log.error(`SmartCallLinkDetails: callLink not found for room ${roomId}`);
    return null;
  }

  return (
    <CallLinkDetails
      callHistoryGroup={callHistoryGroup}
      callLink={callLink}
      i18n={i18n}
      onStartCallLinkLobby={handleStartCallLinkLobby}
      onShareCallLinkViaSignal={handleShareCallLinkViaSignal}
    />
  );
});
