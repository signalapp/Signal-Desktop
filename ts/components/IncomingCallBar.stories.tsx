import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { IncomingCallBar } from './IncomingCallBar';
import { Colors, ColorType } from '../types/Colors';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  acceptCall: action('accept-call'),
  callDetails: {
    callId: 0,
    isIncoming: true,
    isVideoCall: true,

    id: '3051234567',
    avatarPath: undefined,
    contactColor: 'ultramarine' as ColorType,
    name: 'Rick Sanchez',
    phoneNumber: '3051234567',
    profileName: 'Rick Sanchez',
    title: 'Rick Sanchez',
  },
  declineCall: action('decline-call'),
  i18n,
};

const permutations = [
  {
    title: 'Incoming Call Bar (no call details)',
    props: {},
  },
  {
    title: 'Incoming Call Bar (video)',
    props: {
      callDetails: {
        ...defaultProps.callDetails,
        isVideoCall: true,
      },
    },
  },
  {
    title: 'Incoming Call Bar (audio)',
    props: {
      callDetails: {
        ...defaultProps.callDetails,
        isVideoCall: false,
      },
    },
  },
];

storiesOf('Components/IncomingCallBar', module)
  .add('Knobs Playground', () => {
    const color = select('color', Colors, 'ultramarine');
    const isVideoCall = boolean('isVideoCall', false);
    const name = text(
      'name',
      'Rick Sanchez Foo Bar Baz Spool Cool Mango Fango Wand Mars Venus Jupiter Spark Mirage Water Loop Branch Zeus Element Sail Bananas Cars Horticulture Turtle Lion Zebra Micro Music Garage Iguana Ohio Retro Joy Entertainment Logo Understanding Diary'
    );

    return (
      <IncomingCallBar
        {...defaultProps}
        callDetails={{
          ...defaultProps.callDetails,
          color,
          isVideoCall,
          name,
        }}
      />
    );
  })
  .add('Iterations', () => {
    return permutations.map(({ props, title }) => (
      <>
        <h3>{title}</h3>
        <IncomingCallBar {...defaultProps} {...props} />
      </>
    ));
  });
