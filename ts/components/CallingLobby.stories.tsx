// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { times } from 'lodash';
import { storiesOf } from '@storybook/react';
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
      overrideProps.hasLocalAudio || false
    ),
    hasLocalVideo: boolean(
      'hasLocalVideo',
      overrideProps.hasLocalVideo || false
    ),
    i18n,
    isGroupCall,
    isGroupCallOutboundRingEnabled: true,
    isCallFull: boolean('isCallFull', overrideProps.isCallFull || false),
    me: overrideProps.me || {
      color: AvatarColors[0],
      id: UUID.generate().toString(),
      uuid: UUID.generate().toString(),
    },
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

const story = storiesOf('Components/CallingLobby', module);

story.add('Default', () => {
  const props = createProps();
  return <CallingLobby {...props} />;
});

story.add('No Camera, no avatar', () => {
  const props = createProps({
    availableCameras: [],
  });
  return <CallingLobby {...props} />;
});

story.add('No Camera, local avatar', () => {
  const props = createProps({
    availableCameras: [],
    me: {
      avatarPath: '/fixtures/kitten-4-112-112.jpg',
      color: AvatarColors[0],
      id: UUID.generate().toString(),
      uuid: UUID.generate().toString(),
    },
  });
  return <CallingLobby {...props} />;
});

story.add('Local Video', () => {
  const props = createProps({
    hasLocalVideo: true,
  });
  return <CallingLobby {...props} />;
});

story.add('Local Video', () => {
  const props = createProps({
    hasLocalVideo: true,
  });
  return <CallingLobby {...props} />;
});

story.add('Group Call - 0 peeked participants', () => {
  const props = createProps({ isGroupCall: true, peekedParticipants: [] });
  return <CallingLobby {...props} />;
});

story.add('Group Call - 1 peeked participant', () => {
  const props = createProps({
    isGroupCall: true,
    peekedParticipants: [{ title: 'Sam' }].map(fakePeekedParticipant),
  });
  return <CallingLobby {...props} />;
});

story.add('Group Call - 1 peeked participant (self)', () => {
  const uuid = UUID.generate().toString();
  const props = createProps({
    isGroupCall: true,
    me: {
      id: UUID.generate().toString(),
      uuid,
    },
    peekedParticipants: [fakePeekedParticipant({ title: 'Ash', uuid })],
  });
  return <CallingLobby {...props} />;
});

story.add('Group Call - 4 peeked participants', () => {
  const props = createProps({
    isGroupCall: true,
    peekedParticipants: ['Sam', 'Cayce', 'April', 'Logan', 'Carl'].map(title =>
      fakePeekedParticipant({ title })
    ),
  });
  return <CallingLobby {...props} />;
});

story.add('Group Call - 4 peeked participants (participants list)', () => {
  const props = createProps({
    isGroupCall: true,
    peekedParticipants: ['Sam', 'Cayce', 'April', 'Logan', 'Carl'].map(title =>
      fakePeekedParticipant({ title })
    ),
    showParticipantsList: true,
  });
  return <CallingLobby {...props} />;
});

story.add('Group Call - call full', () => {
  const props = createProps({
    isGroupCall: true,
    isCallFull: true,
    peekedParticipants: ['Sam', 'Cayce'].map(title =>
      fakePeekedParticipant({ title })
    ),
  });
  return <CallingLobby {...props} />;
});

story.add('Group Call - 0 peeked participants, big group', () => {
  const props = createProps({
    isGroupCall: true,
    groupMembers: times(100, () => getDefaultConversation()),
  });
  return <CallingLobby {...props} />;
});
