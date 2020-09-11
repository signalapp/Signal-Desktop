import * as React from 'react';
import { SafetyNumberViewer } from './SafetyNumberViewer';
import { ConversationType } from '../state/ducks/conversations';

// @ts-ignore
import { setup as setupI18n } from '../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../_locales/en/messages.json';

import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

const i18n = setupI18n('en', enMessages);

const contactWithAllData = {
  title: 'Summer Smith',
  name: 'Summer Smith',
  phoneNumber: '(305) 123-4567',
  isVerified: true,
} as ConversationType;

const contactWithJustProfile = {
  avatarPath: undefined,
  color: 'signal-blue',
  title: '-*Smartest Dude*-',
  profileName: '-*Smartest Dude*-',
  name: undefined,
  phoneNumber: '(305) 123-4567',
} as ConversationType;

const contactWithJustNumber = {
  avatarPath: undefined,
  color: 'signal-blue',
  profileName: undefined,
  name: undefined,
  title: '(305) 123-4567',
  phoneNumber: '(305) 123-4567',
} as ConversationType;

const contactWithNothing = {
  id: 'some-guid',
  avatarPath: undefined,
  color: 'signal-blue',
  profileName: undefined,
  title: 'Unknown contact',
  name: undefined,
  phoneNumber: undefined,
} as ConversationType;

const defaultProps = {
  contact: contactWithAllData,
  generateSafetyNumber: action('generate-safety-number'),
  i18n,
  safetyNumber: 'XXX',
  safetyNumberChanged: false,
  toggleVerified: action('toggle-verified'),
  verificationDisabled: false,
};

const permutations = [
  {
    title: 'Safety Number',
    props: {},
  },
  {
    title: 'Safety Number (not verified)',
    props: {
      contact: {
        ...contactWithAllData,
        verified: false,
      },
    },
  },
  {
    title: 'Verification Disabled',
    props: {
      verificationDisabled: true,
    },
  },
  {
    title: 'Safety Number Changed',
    props: {
      safetyNumberChanged: true,
    },
  },
  {
    title: 'Safety Number (dialog close)',
    props: {
      onClose: action('close'),
    },
  },
  {
    title: 'Just Profile',
    props: {
      contact: contactWithJustProfile,
    },
  },
  {
    title: 'Just Number',
    props: {
      contact: contactWithJustNumber,
    },
  },
  {
    title: 'No display info',
    props: {
      contact: contactWithNothing,
    },
  },
];

storiesOf('Components/SafetyNumberViewer', module)
  .add('Knobs Playground', () => {
    const safetyNumber = text('safetyNumber', 'XXX');
    const safetyNumberChanged = boolean('safetyNumberChanged', false);
    const verificationDisabled = boolean('verificationDisabled', false);

    return (
      <SafetyNumberViewer
        {...defaultProps}
        safetyNumber={safetyNumber}
        safetyNumberChanged={safetyNumberChanged}
        verificationDisabled={verificationDisabled}
      />
    );
  })
  .add('Iterations', () => {
    return permutations.map(({ props, title }) => (
      <>
        <h3>{title}</h3>
        <SafetyNumberViewer {...defaultProps} {...props} />
      </>
    ));
  });
