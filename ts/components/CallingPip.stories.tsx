// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { noop } from 'lodash';
import { storiesOf } from '@storybook/react';
import { boolean } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { ColorType } from '../types/Colors';
import { ConversationTypeType } from '../state/ducks/conversations';
import { ActiveCallType } from '../state/ducks/calling';
import { CallingPip, PropsType } from './CallingPip';
import {
  CallMode,
  CallState,
  GroupCallConnectionState,
  GroupCallJoinState,
} from '../types/Calling';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const conversation = {
  id: '3051234567',
  avatarPath: undefined,
  color: 'ultramarine' as ColorType,
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
  profileName: 'Rick Sanchez',
  markedUnread: false,
  type: 'direct' as ConversationTypeType,
  lastUpdated: Date.now(),
};

const defaultCall = {
  callMode: CallMode.Direct as CallMode.Direct,
  conversationId: '3051234567',
  callState: CallState.Accepted,
  isIncoming: false,
  isVideoCall: true,
  hasRemoteVideo: true,
};

const createProps = (
  overrideProps: Partial<PropsType> = {},
  activeCall: Partial<ActiveCallType> = {}
): PropsType => ({
  activeCall: {
    activeCallState: {
      conversationId: '123',
      hasLocalAudio: true,
      hasLocalVideo: true,
      pip: false,
      settingsDialogOpen: false,
      showParticipantsList: true,
    },
    call: activeCall.call || defaultCall,
    conversation: activeCall.conversation || conversation,
    isCallFull: false,
    groupCallPeekedParticipants: [],
    groupCallParticipants: [],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getGroupCallVideoFrameSource: noop as any,
  hangUp: action('hang-up'),
  hasLocalVideo: boolean('hasLocalVideo', overrideProps.hasLocalVideo || false),
  i18n,
  setLocalPreview: action('set-local-preview'),
  setRendererCanvas: action('set-renderer-canvas'),
  togglePip: action('toggle-pip'),
});

const story = storiesOf('Components/CallingPip', module);

story.add('Default', () => {
  const props = createProps({});
  return <CallingPip {...props} />;
});

story.add('Contact (with avatar)', () => {
  const props = createProps(
    {},
    {
      conversation: {
        ...conversation,
        avatarPath: 'https://www.fillmurray.com/64/64',
      },
    }
  );
  return <CallingPip {...props} />;
});

story.add('Contact (no color)', () => {
  const props = createProps(
    {},
    {
      conversation: {
        ...conversation,
        color: undefined,
      },
    }
  );
  return <CallingPip {...props} />;
});

story.add('Group Call', () => {
  const props = createProps(
    {},
    {
      call: {
        callMode: CallMode.Group as CallMode.Group,
        conversationId: '3051234567',
        connectionState: GroupCallConnectionState.Connected,
        joinState: GroupCallJoinState.Joined,
        peekInfo: {
          conversationIds: [],
          maxDevices: 16,
          deviceCount: 0,
        },
        remoteParticipants: [],
      },
    }
  );
  return <CallingPip {...props} />;
});
