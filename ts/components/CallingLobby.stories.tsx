// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { ColorType } from '../types/Colors';
import { CallingLobby, PropsType } from './CallingLobby';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

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

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  availableCameras: overrideProps.availableCameras || [camera],
  conversation: {
    title: 'Rick Sanchez',
  },
  hasLocalAudio: boolean('hasLocalAudio', overrideProps.hasLocalAudio || false),
  hasLocalVideo: boolean('hasLocalVideo', overrideProps.hasLocalVideo || false),
  i18n,
  isGroupCall: boolean('isGroupCall', overrideProps.isGroupCall || false),
  me: overrideProps.me || { color: 'ultramarine' as ColorType },
  onCallCanceled: action('on-call-canceled'),
  onJoinCall: action('on-join-call'),
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  toggleParticipants: action('toggle-participants'),
  toggleSettings: action('toggle-settings'),
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
      color: 'ultramarine' as ColorType,
      avatarPath: '/fixtures/kitten-4-112-112.jpg',
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

story.add('Group Call', () => {
  const props = createProps({ isGroupCall: true });
  return <CallingLobby {...props} />;
});
