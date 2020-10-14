import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { CallManager } from './CallManager';
import { CallEndedReason, CallState } from '../types/Calling';
import { ColorType } from '../types/Colors';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const callDetails = {
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

const defaultProps = {
  availableCameras: [],
  acceptCall: action('accept-call'),
  callDetails,
  callState: CallState.Accepted,
  cancelCall: action('cancel-call'),
  closeNeedPermissionScreen: action('close-need-permission-screen'),
  declineCall: action('decline-call'),
  hangUp: action('hang-up'),
  hasLocalAudio: true,
  hasLocalVideo: true,
  hasRemoteVideo: true,
  i18n,
  pip: false,
  renderDeviceSelection: () => <div />,
  setLocalAudio: action('set-local-audio'),
  setLocalPreview: action('set-local-preview'),
  setLocalVideo: action('set-local-video'),
  setRendererCanvas: action('set-renderer-canvas'),
  settingsDialogOpen: false,
  startCall: action('start-call'),
  toggleParticipants: action('toggle-participants'),
  togglePip: action('toggle-pip'),
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
  {
    title: 'Call Manager (call request needed)',
    props: {
      callState: CallState.Ended,
      callEndedReason: CallEndedReason.RemoteHangupNeedPermission,
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
