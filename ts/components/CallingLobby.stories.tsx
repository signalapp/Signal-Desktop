// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';
import { boolean } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { AvatarColors } from '../types/Colors';
import type { ConversationType } from '../state/ducks/conversations';
import type { PropsType } from './CallingLobby';
import { CallingLobby } from './CallingLobby';
import { setupI18n } from '../util/setupI18n';
import { UUID } from '../types/UUID';
import enMessages from '../../_locales/en/messages.json';
import {
  getDefaultConversation,
  getDefaultConversationWithUuid,
} from '../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

const camera = {
  deviceId: 'dfbe6effe70b0611ba0fdc2a9ea3f39f6cb110e6687948f7e5f016c111b7329c',
  groupId: '63ee218d2446869e40adfc958ff98263e51f74382b0143328ee4826f20a76f47',
  kind: 'videoinput' as MediaDeviceKind,
  label: 'FaceTime HD Camera (Built-in) (9fba:bced)',
  toJSON() {
    return '';
  },
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => {
  const isGroupCall = boolean(
    'isGroupCall',
    overrideProps.isGroupCall || false
  );
  const conversation = isGroupCall
    ? getDefaultConversation({
        title: 'Tahoe Trip',
        type: 'group',
      })
    : getDefaultConversation();

  return {
    availableCameras: overrideProps.availableCameras || [camera],
    conversation,
    groupMembers:
      overrideProps.groupMembers ||
      (isGroupCall ? times(3, () => getDefaultConversation()) : undefined),
    hasLocalAudio: boolean(
      'hasLocalAudio',
      overrideProps.hasLocalAudio ?? true
    ),
    hasLocalVideo: boolean(
      'hasLocalVideo',
      overrideProps.hasLocalVideo ?? false
    ),
    i18n,
    isGroupCall,
    isGroupCallOutboundRingEnabled: true,
    isCallFull: boolean('isCallFull', overrideProps.isCallFull || false),
    me:
      overrideProps.me ||
      getDefaultConversation({
        color: AvatarColors[0],
        id: UUID.generate().toString(),
        uuid: UUID.generate().toString(),
      }),
    onCallCanceled: action('on-call-canceled'),
    onJoinCall: action('on-join-call'),
    outgoingRing: boolean('outgoingRing', Boolean(overrideProps.outgoingRing)),
    peekedParticipants: overrideProps.peekedParticipants || [],
    setLocalAudio: action('set-local-audio'),
    setLocalPreview: action('set-local-preview'),
    setLocalVideo: action('set-local-video'),
    setOutgoingRing: action('set-outgoing-ring'),
    showParticipantsList: boolean(
      'showParticipantsList',
      Boolean(overrideProps.showParticipantsList)
    ),
    toggleParticipants: action('toggle-participants'),
    toggleSettings: action('toggle-settings'),
  };
};

const fakePeekedParticipant = (conversationProps: Partial<ConversationType>) =>
  getDefaultConversationWithUuid({
    ...conversationProps,
  });

export default {
  title: 'Components/CallingLobby',
};

export const Default = (): JSX.Element => {
  const props = createProps();
  return <CallingLobby {...props} />;
};

export const NoCameraNoAvatar = (): JSX.Element => {
  const props = createProps({
    availableCameras: [],
  });
  return <CallingLobby {...props} />;
};

NoCameraNoAvatar.story = {
  name: 'No Camera, no avatar',
};

export const NoCameraLocalAvatar = (): JSX.Element => {
  const props = createProps({
    availableCameras: [],
    me: getDefaultConversation({
      avatarPath: '/fixtures/kitten-4-112-112.jpg',
      color: AvatarColors[0],
      id: UUID.generate().toString(),
      uuid: UUID.generate().toString(),
    }),
  });
  return <CallingLobby {...props} />;
};

NoCameraLocalAvatar.story = {
  name: 'No Camera, local avatar',
};

export const LocalVideo = (): JSX.Element => {
  const props = createProps({
    hasLocalVideo: true,
  });
  return <CallingLobby {...props} />;
};

export const InitiallyMuted = (): JSX.Element => {
  const props = createProps({
    hasLocalAudio: false,
  });
  return <CallingLobby {...props} />;
};

InitiallyMuted.story = {
  name: 'Initially muted',
};

export const GroupCall0PeekedParticipants = (): JSX.Element => {
  const props = createProps({ isGroupCall: true, peekedParticipants: [] });
  return <CallingLobby {...props} />;
};

GroupCall0PeekedParticipants.story = {
  name: 'Group Call - 0 peeked participants',
};

export const GroupCall1PeekedParticipant = (): JSX.Element => {
  const props = createProps({
    isGroupCall: true,
    peekedParticipants: [{ title: 'Sam' }].map(fakePeekedParticipant),
  });
  return <CallingLobby {...props} />;
};

GroupCall1PeekedParticipant.story = {
  name: 'Group Call - 1 peeked participant',
};

export const GroupCall1PeekedParticipantSelf = (): JSX.Element => {
  const uuid = UUID.generate().toString();
  const props = createProps({
    isGroupCall: true,
    me: getDefaultConversation({
      id: UUID.generate().toString(),
      uuid,
    }),
    peekedParticipants: [fakePeekedParticipant({ title: 'Ash', uuid })],
  });
  return <CallingLobby {...props} />;
};

GroupCall1PeekedParticipantSelf.story = {
  name: 'Group Call - 1 peeked participant (self)',
};

export const GroupCall4PeekedParticipants = (): JSX.Element => {
  const props = createProps({
    isGroupCall: true,
    peekedParticipants: ['Sam', 'Cayce', 'April', 'Logan', 'Carl'].map(title =>
      fakePeekedParticipant({ title })
    ),
  });
  return <CallingLobby {...props} />;
};

GroupCall4PeekedParticipants.story = {
  name: 'Group Call - 4 peeked participants',
};

export const GroupCall4PeekedParticipantsParticipantsList = (): JSX.Element => {
  const props = createProps({
    isGroupCall: true,
    peekedParticipants: ['Sam', 'Cayce', 'April', 'Logan', 'Carl'].map(title =>
      fakePeekedParticipant({ title })
    ),
    showParticipantsList: true,
  });
  return <CallingLobby {...props} />;
};

GroupCall4PeekedParticipantsParticipantsList.story = {
  name: 'Group Call - 4 peeked participants (participants list)',
};

export const GroupCallCallFull = (): JSX.Element => {
  const props = createProps({
    isGroupCall: true,
    isCallFull: true,
    peekedParticipants: ['Sam', 'Cayce'].map(title =>
      fakePeekedParticipant({ title })
    ),
  });
  return <CallingLobby {...props} />;
};

GroupCallCallFull.story = {
  name: 'Group Call - call full',
};

export const GroupCall0PeekedParticipantsBigGroup = (): JSX.Element => {
  const props = createProps({
    isGroupCall: true,
    groupMembers: times(100, () => getDefaultConversation()),
  });
  return <CallingLobby {...props} />;
};

GroupCall0PeekedParticipantsBigGroup.story = {
  name: 'Group Call - 0 peeked participants, big group',
};
