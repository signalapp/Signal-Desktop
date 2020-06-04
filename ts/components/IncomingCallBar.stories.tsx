import * as React from 'react';
import { IncomingCallBar } from './IncomingCallBar';
import { ColorType } from '../types/Util';

// @ts-ignore
import { setup as setupI18n } from '../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../_locales/en/messages.json';

import { storiesOf } from '@storybook/react';
import { boolean, select, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

const i18n = setupI18n('en', enMessages);

const defaultProps = {
  acceptCall: action('accept-call'),
  callDetails: {
    avatarPath: undefined,
    callId: 0,
    contactColor: 'ultramarine' as ColorType,
    isIncoming: true,
    isVideoCall: true,
    name: 'Rick Sanchez',
    phoneNumber: '3051234567',
    profileName: 'Rick Sanchez',
  },
  declineCall: action('decline-call'),
  i18n,
};

const colors: Array<ColorType> = [
  'blue',
  'blue_grey',
  'brown',
  'deep_orange',
  'green',
  'grey',
  'indigo',
  'light_green',
  'pink',
  'purple',
  'red',
  'teal',
  'ultramarine',
];

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
    const contactColor = select('contactColor', colors, 'ultramarine');
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
          contactColor,
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
