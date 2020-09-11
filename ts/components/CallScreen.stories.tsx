import * as React from 'react';
import { CallState } from '../types/Calling';
import { ColorType } from '../types/Colors';
import { CallScreen } from './CallScreen';

// @ts-ignore
import { setup as setupI18n } from '../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../_locales/en/messages.json';

import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

const i18n = setupI18n('en', enMessages);

const callDetails = {
  callId: 0,
  isIncoming: true,
  isVideoCall: true,

  avatarPath: undefined,
  color: 'ultramarine' as ColorType,
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
};

const defaultProps = {
  callDetails,
  callState: CallState.Accepted,
  hangUp: action('hang-up'),
  hasLocalAudio: true,
  hasLocalVideo: true,
  hasRemoteVideo: true,
  i18n,
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  setRendererCanvas: action('set-renderer-canvas'),
  toggleSettings: action('toggle-settings'),
};

const permutations = [
  {
    title: 'Call Screen',
    props: {},
  },
  {
    title: 'Call Screen (Pre-ring)',
    props: {
      callState: CallState.Prering,
    },
  },
  {
    title: 'Call Screen (Ringing)',
    props: {
      callState: CallState.Ringing,
    },
  },
  {
    title: 'Call Screen (Reconnecting)',
    props: {
      callState: CallState.Reconnecting,
    },
  },
  {
    title: 'Call Screen (Ended)',
    props: {
      callState: CallState.Ended,
    },
  },
  {
    title: 'Calling (no local audio)',
    props: {
      ...defaultProps,
      hasLocalAudio: false,
    },
  },
  {
    title: 'Calling (no local video)',
    props: {
      ...defaultProps,
      hasLocalVideo: false,
    },
  },
  {
    title: 'Calling (no remote video)',
    props: {
      ...defaultProps,
      hasRemoteVideo: false,
    },
  },
];

storiesOf('Components/CallScreen', module)
  .add('Knobs Playground', () => {
    const callState = select('callState', CallState, CallState.Accepted);
    const hasLocalAudio = boolean('hasLocalAudio', true);
    const hasLocalVideo = boolean('hasLocalVideo', true);
    const hasRemoteVideo = boolean('hasRemoteVideo', true);

    return (
      <CallScreen
        {...defaultProps}
        callState={callState}
        hasLocalAudio={hasLocalAudio}
        hasLocalVideo={hasLocalVideo}
        hasRemoteVideo={hasRemoteVideo}
      />
    );
  })
  .add('Iterations', () => {
    return permutations.map(({ props, title }) => (
      <>
        <h3>{title}</h3>
        <CallScreen {...defaultProps} {...props} />
      </>
    ));
  });
