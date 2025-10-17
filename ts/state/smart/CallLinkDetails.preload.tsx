// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import type { CallHistoryGroup } from '../../types/CallDisposition.std.js';
import { getIntl } from '../selectors/user.std.js';
import { CallLinkDetails } from '../../components/CallLinkDetails.dom.js';
import {
  getActiveCallState,
  getAdhocCallSelector,
  getCallLinkSelector,
} from '../selectors/calling.std.js';
import { useGlobalModalActions } from '../ducks/globalModals.preload.js';
import { useCallingActions } from '../ducks/calling.preload.js';
import { strictAssert } from '../../util/assert.std.js';
import type { CallLinkRestrictions } from '../../types/CallLink.std.js';
import {
  isAnybodyInGroupCall,
  isGroupCallActiveOnServer,
} from '../ducks/callingHelpers.std.js';

export type SmartCallLinkDetailsProps = Readonly<{
  roomId: string;
  callHistoryGroup: CallHistoryGroup;
  onClose: () => void;
}>;

export const SmartCallLinkDetails = memo(function SmartCallLinkDetails({
  roomId,
  callHistoryGroup,
  onClose,
}: SmartCallLinkDetailsProps) {
  const i18n = useSelector(getIntl);
  const callLinkSelector = useSelector(getCallLinkSelector);

  const { deleteCallLink, startCallLinkLobby, updateCallLinkRestrictions } =
    useCallingActions();
  const { toggleCallLinkAddNameModal, showShareCallLinkViaSignal } =
    useGlobalModalActions();

  const callLink = callLinkSelector(roomId);

  const handleDeleteCallLink = useCallback(() => {
    strictAssert(callLink != null, 'callLink not found');
    deleteCallLink(callLink.roomId);
    onClose();
  }, [callLink, deleteCallLink, onClose]);

  const handleOpenCallLinkAddNameModal = useCallback(() => {
    toggleCallLinkAddNameModal(roomId);
  }, [roomId, toggleCallLinkAddNameModal]);

  const handleShareCallLinkViaSignal = useCallback(() => {
    strictAssert(callLink != null, 'callLink not found');
    showShareCallLinkViaSignal(callLink, i18n);
  }, [callLink, i18n, showShareCallLinkViaSignal]);

  const handleStartCallLinkLobby = useCallback(() => {
    strictAssert(callLink != null, 'callLink not found');
    startCallLinkLobby({ rootKey: callLink.rootKey, epoch: callLink.epoch });
  }, [callLink, startCallLinkLobby]);

  const handleUpdateCallLinkRestrictions = useCallback(
    (newRestrictions: CallLinkRestrictions) => {
      updateCallLinkRestrictions(roomId, newRestrictions);
    },
    [roomId, updateCallLinkRestrictions]
  );

  const adhocCallSelector = useSelector(getAdhocCallSelector);
  const adhocCall = adhocCallSelector(roomId);
  const isAnybodyInCall = isAnybodyInGroupCall(adhocCall?.peekInfo);
  const isCallActiveOnServer = isGroupCallActiveOnServer(adhocCall?.peekInfo);

  const activeCall = useSelector(getActiveCallState);
  const isInAnotherCall = Boolean(
    activeCall && callLink && activeCall.conversationId !== callLink.roomId
  );
  const isInCall = Boolean(
    activeCall && callLink && activeCall.conversationId === callLink.roomId
  );

  return (
    <CallLinkDetails
      callHistoryGroup={callHistoryGroup}
      callLink={callLink}
      isAnybodyInCall={isAnybodyInCall}
      isCallActiveOnServer={isCallActiveOnServer}
      isInCall={isInCall}
      isInAnotherCall={isInAnotherCall}
      i18n={i18n}
      onDeleteCallLink={handleDeleteCallLink}
      onOpenCallLinkAddNameModal={handleOpenCallLinkAddNameModal}
      onStartCallLinkLobby={handleStartCallLinkLobby}
      onShareCallLinkViaSignal={handleShareCallLinkViaSignal}
      onUpdateCallLinkRestrictions={handleUpdateCallLinkRestrictions}
    />
  );
});
