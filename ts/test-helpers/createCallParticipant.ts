// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';

import { AvatarColors } from '../types/Colors.std.js';
import type { GroupCallRemoteParticipantType } from '../types/Calling.std.js';
import { generateAci } from '../types/ServiceId.std.js';

import { getDefaultConversationWithServiceId } from './getDefaultConversation.std.js';

const { sample } = lodash;

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
