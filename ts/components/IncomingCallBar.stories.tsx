// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { IncomingCallBar } from './IncomingCallBar';
import { AvatarColors } from '../types/Colors';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { getRandomColor } from '../test-both/helpers/getRandomColor';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  acceptCall: action('accept-call'),
  call: {
    conversationId: 'fake-conversation-id',
    callId: 0,
    isIncoming: true,
    isVideoCall: true,
  },
  conversation: getDefaultConversation({
    id: '3051234567',
    avatarPath: undefined,
    name: 'Rick Sanchez',
    phoneNumber: '3051234567',
    profileName: 'Rick Sanchez',
    title: 'Rick Sanchez',
  }),
  declineCall: action('decline-call'),
  i18n,
};

storiesOf('Components/IncomingCallBar', module)
  .add('Knobs Playground', () => {
    const color = select('color', AvatarColors, getRandomColor());
    const isVideoCall = boolean('isVideoCall', false);
    const name = text(
      'name',
      'Rick Sanchez Foo Bar Baz Spool Cool Mango Fango Wand Mars Venus Jupiter Spark Mirage Water Loop Branch Zeus Element Sail Bananas Cars Horticulture Turtle Lion Zebra Micro Music Garage Iguana Ohio Retro Joy Entertainment Logo Understanding Diary'
    );

    return (
      <IncomingCallBar
        {...defaultProps}
        call={{
          ...defaultProps.call,
          isVideoCall,
        }}
        conversation={{
          ...defaultProps.conversation,
          color,
          name,
        }}
      />
    );
  })
  .add('Incoming Call Bar (video)', () => <IncomingCallBar {...defaultProps} />)
  .add('Incoming Call Bar (audio)', () => (
    <IncomingCallBar
      {...defaultProps}
      call={{ ...defaultProps.call, isVideoCall: false }}
    />
  ));
