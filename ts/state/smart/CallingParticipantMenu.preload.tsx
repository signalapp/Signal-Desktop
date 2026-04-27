// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { getItems } from '../selectors/items.dom.ts';
import { getIntl, getVersion } from '../selectors/user.std.ts';
import {
  getActiveCall,
  getActiveCallState,
  getCallLinkSelector,
} from '../selectors/calling.std.ts';
import { getConversationSelector } from '../selectors/conversations.dom.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useCallingActions } from '../ducks/calling.preload.ts';
import { CallMode } from '../../types/CallDisposition.std.ts';
import { isCallLinkAdmin } from '../../types/CallLink.std.ts';
import { isFeaturedEnabledSelector } from '../../util/isFeatureEnabled.dom.ts';
import { getMe } from '../selectors/conversations.dom.ts';
import { CallingParticipantMenu } from '../../components/CallingParticipantMenu.dom.tsx';
import type { AxoMenuBuilder } from '../../axo/AxoMenuBuilder.dom.tsx';

export type PropsType = {
  callConversationId?: string;
  participantConversationId?: string;
  demuxId?: number;
  hasAudio: boolean;
  align: AxoMenuBuilder.Align;
  side: AxoMenuBuilder.Side;
  renderer: AxoMenuBuilder.Renderer;
  children: ReactNode;
};

export const SmartCallingParticipantMenu = memo(
  function SmartCallingParticipantMenu({
    callConversationId,
    participantConversationId,
    demuxId,
    hasAudio,
    align,
    side,
    renderer,
    children,
  }: PropsType) {
    const i18n = useSelector(getIntl);
    const version = useSelector(getVersion);
    const items = useSelector(getItems);
    const isRemoteMuteSendEnabled = isFeaturedEnabledSelector({
      betaKey: 'desktop.remoteMute.send.beta',
      currentVersion: version,
      remoteConfig: items.remoteConfig,
      prodKey: 'desktop.remoteMute.send.prod',
    });

    const callLinkSelector = useSelector(getCallLinkSelector);
    const activeCallState = useSelector(getActiveCallState);
    const activeCall = useSelector(getActiveCall);
    const localDemuxId =
      activeCall && 'localDemuxId' in activeCall
        ? activeCall.localDemuxId
        : undefined;

    const conversationSelector = useSelector(getConversationSelector);
    const participantConversation = conversationSelector(
      participantConversationId
    );
    const me = useSelector(getMe);
    const isMe = Boolean(
      me.serviceId && me.serviceId === participantConversation.serviceId
    );
    const isMeOnAnotherDevice = isMe && demuxId !== localDemuxId;

    const { showContactModal } = useGlobalModalActions();
    const { showConversation } = useConversationsActions();
    const { setLocalAudio, removeClient, sendRemoteMute } = useCallingActions();

    let onMuteAudio: (() => void) | null;
    let onUnmuteAudio: (() => void) | null;
    let onViewProfile: (() => void) | null;
    let onGoToChat: (() => void) | null;

    if (isMe) {
      if (isMeOnAnotherDevice) {
        onMuteAudio =
          isRemoteMuteSendEnabled && demuxId
            ? () => sendRemoteMute(demuxId)
            : null;
        onUnmuteAudio = null;
      } else {
        onMuteAudio = hasAudio ? () => setLocalAudio({ enabled: false }) : null;
        onUnmuteAudio = hasAudio
          ? null
          : () => setLocalAudio({ enabled: true });
      }

      onGoToChat = null;
      onViewProfile = null;
    } else {
      onMuteAudio =
        isRemoteMuteSendEnabled && demuxId
          ? () => sendRemoteMute(demuxId)
          : null;
      onUnmuteAudio = null;

      if (participantConversation) {
        onGoToChat = () =>
          showConversation({ conversationId: participantConversation.id });
        onViewProfile = () =>
          showContactModal({
            activeCallDemuxId: demuxId,
            contactId: participantConversation.id,
            conversationId: callConversationId,
          });
      } else {
        onGoToChat = null;
        onViewProfile = null;
      }
    }

    let onRemoveFromCall: (() => void) | null = null;
    if (activeCallState?.callMode === CallMode.Adhoc) {
      const callLink = callLinkSelector(activeCallState.conversationId);
      if (
        callLink &&
        isCallLinkAdmin(callLink) &&
        demuxId !== undefined &&
        demuxId !== localDemuxId
      ) {
        onRemoveFromCall = () => removeClient({ demuxId });
      }
    }

    return (
      <CallingParticipantMenu
        align={align}
        side={side}
        renderer={renderer}
        i18n={i18n}
        isMuteAudioDisabled={!hasAudio}
        onMuteAudio={onMuteAudio}
        onUnmuteAudio={onUnmuteAudio}
        onGoToChat={onGoToChat}
        onRemoveFromCall={onRemoveFromCall}
        onViewProfile={onViewProfile}
      >
        {children}
      </CallingParticipantMenu>
    );
  }
);
