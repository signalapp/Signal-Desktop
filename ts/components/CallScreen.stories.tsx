// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { noop } from 'lodash';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { CallMode, CallState } from '../types/Calling';
import { ColorType } from '../types/Colors';
import { CallScreen, PropsType } from './CallScreen';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (
  overrideProps: {
    callState?: CallState;
    hasLocalAudio?: boolean;
    hasLocalVideo?: boolean;
    hasRemoteVideo?: boolean;
  } = {}
): PropsType => ({
  call: {
    callMode: CallMode.Direct as CallMode.Direct,
    conversationId: '3051234567',
    callState: select(
      'callState',
      CallState,
      overrideProps.callState || CallState.Accepted
    ),
    isIncoming: false,
    isVideoCall: true,
    hasRemoteVideo: boolean(
      'hasRemoteVideo',
      overrideProps.hasRemoteVideo || false
    ),
  },
  conversation: {
    id: '3051234567',
    avatarPath: undefined,
    color: 'ultramarine' as ColorType,
    title: 'Rick Sanchez',
    name: 'Rick Sanchez',
    phoneNumber: '3051234567',
    profileName: 'Rick Sanchez',
    markedUnread: false,
    type: 'direct',
    lastUpdated: Date.now(),
  },
  // We allow `any` here because these are fake and actually come from RingRTC, which we
  //   can't import.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  createCanvasVideoRenderer: () =>
    ({
      setCanvas: noop,
      enable: noop,
      disable: noop,
    } as any),
  getGroupCallVideoFrameSource: noop as any,
  /* eslint-enable @typescript-eslint/no-explicit-any */
  hangUp: action('hang-up'),
  hasLocalAudio: boolean('hasLocalAudio', overrideProps.hasLocalAudio || false),
  hasLocalVideo: boolean('hasLocalVideo', overrideProps.hasLocalVideo || false),
  i18n,
  joinedAt: Date.now(),
  me: {
    color: 'ultramarine' as ColorType,
    name: 'Morty Smith',
    profileName: 'Morty Smith',
    title: 'Morty Smith',
  },
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  setRendererCanvas: action('set-renderer-canvas'),
  togglePip: action('toggle-pip'),
  toggleSettings: action('toggle-settings'),
});

const story = storiesOf('Components/CallScreen', module);

story.add('Default', () => {
  return <CallScreen {...createProps()} />;
});

story.add('Pre-Ring', () => {
  return <CallScreen {...createProps({ callState: CallState.Prering })} />;
});

story.add('Ringing', () => {
  return <CallScreen {...createProps({ callState: CallState.Ringing })} />;
});

story.add('Reconnecting', () => {
  return <CallScreen {...createProps({ callState: CallState.Reconnecting })} />;
});

story.add('Ended', () => {
  return <CallScreen {...createProps({ callState: CallState.Ended })} />;
});

story.add('hasLocalAudio', () => {
  return <CallScreen {...createProps({ hasLocalAudio: true })} />;
});

story.add('hasLocalVideo', () => {
  return <CallScreen {...createProps({ hasLocalVideo: true })} />;
});

story.add('hasRemoteVideo', () => {
  return <CallScreen {...createProps({ hasRemoteVideo: true })} />;
});
