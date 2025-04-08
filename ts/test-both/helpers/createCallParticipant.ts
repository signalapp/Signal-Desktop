// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { sample } from 'lodash';

import { AvatarColors } from '../../types/Colors';
import type { GroupCallRemoteParticipantType } from '../../types/Calling';
import { generateAci } from '../../types/ServiceId';

import { getDefaultConversationWithServiceId } from './getDefaultConversation';

export function createCallParticipant(
  participantProps: Partial<GroupCallRemoteParticipantType>
): GroupCallRemoteParticipantType {
  return {
    aci: generateAci(),
    demuxId: 2,
    hasRemoteAudio: Boolean(participantProps.hasRemoteAudio),
    hasRemoteVideo: Boolean(participantProps.hasRemoteVideo),
    isHandRaised: Boolean(participantProps.isHandRaised),
    mediaKeysReceived: Boolean(participantProps.mediaKeysReceived),
    presenting: Boolean(participantProps.presenting),
    sharingScreen: Boolean(participantProps.sharingScreen),
    videoAspectRatio: 1.3,
    ...getDefaultConversationWithServiceId({
      avatarUrl: participantProps.avatarUrl,
      color: sample(AvatarColors),
      isBlocked: Boolean(participantProps.isBlocked),
      name: participantProps.name,
      profileName: participantProps.title,
      title: String(participantProps.title),
    }),
  };
}
