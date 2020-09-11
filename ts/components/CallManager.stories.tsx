import * as React from 'react';
import { CallManager } from './CallManager';
import { CallState } from '../types/Calling';
import { ColorType } from '../types/Colors';

// @ts-ignore
import { setup as setupI18n } from '../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../_locales/en/messages.json';

import { storiesOf } from '@storybook/react';
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
  acceptCall: action('accept-call'),
  callDetails,
  callState: CallState.Accepted,
  declineCall: action('decline-call'),
  hangUp: action('hang-up'),
  hasLocalAudio: true,
  hasLocalVideo: true,
  hasRemoteVideo: true,
  i18n,
  renderDeviceSelection: () => <div />,
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  setRendererCanvas: action('set-renderer-canvas'),
  settingsDialogOpen: false,
  toggleSettings: action('toggle-settings'),
};

const permutations = [
  {
    title: 'Call Manager (ongoing)',
    props: {},
  },
  {
    title: 'Call Manager (ringing)',
    props: {
      callState: CallState.Ringing,
    },
  },
];

storiesOf('Components/CallManager', module).add('Iterations', () => {
  return permutations.map(({ props, title }) => (
    <>
      <h3>{title}</h3>
      <CallManager {...defaultProps} {...props} />
    </>
  ));
});
