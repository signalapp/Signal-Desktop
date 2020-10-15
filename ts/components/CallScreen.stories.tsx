import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { CallState } from '../types/Calling';
import { ColorType } from '../types/Colors';
import { CallScreen, PropsType } from './CallScreen';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const callDetails = {
  acceptedTime: Date.now(),
  callId: 0,
  isIncoming: true,
  isVideoCall: true,

  id: '3051234567',
  avatarPath: undefined,
  color: 'ultramarine' as ColorType,
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
};

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  callDetails,
  callState: select(
    'callState',
    CallState,
    overrideProps.callState || CallState.Accepted
  ),
  hangUp: action('hang-up'),
  hasLocalAudio: boolean('hasLocalAudio', overrideProps.hasLocalAudio || false),
  hasLocalVideo: boolean('hasLocalVideo', overrideProps.hasLocalVideo || false),
  hasRemoteVideo: boolean(
    'hasRemoteVideo',
    overrideProps.hasRemoteVideo || false
  ),
  i18n,
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
