// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { PropsType, SafetyNumberViewer } from './SafetyNumberViewer';
import { ConversationType } from '../state/ducks/conversations';
import { setup as setupI18n } from '../../js/modules/i18n';
import enMessages from '../../_locales/en/messages.json';

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

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  contact: overrideProps.contact || contactWithAllData,
  generateSafetyNumber: action('generate-safety-number'),
  i18n,
  safetyNumber: text('safetyNumber', overrideProps.safetyNumber || 'XXX'),
  safetyNumberChanged: boolean(
    'safetyNumberChanged',
    overrideProps.safetyNumberChanged !== undefined
      ? overrideProps.safetyNumberChanged
      : false
  ),
  toggleVerified: action('toggle-verified'),
  verificationDisabled: boolean(
    'verificationDisabled',
    overrideProps.verificationDisabled !== undefined
      ? overrideProps.verificationDisabled
      : false
  ),
  onClose: overrideProps.onClose,
});

const story = storiesOf('Components/SafetyNumberViewer', module);

story.add('Safety Number', () => {
  return <SafetyNumberViewer {...createProps({})} />;
});

story.add('Safety Number (not verified)', () => {
  return (
    <SafetyNumberViewer
      {...createProps({
        contact: {
          ...contactWithAllData,
          isVerified: false,
        },
      })}
    />
  );
});

story.add('Verification Disabled', () => {
  return (
    <SafetyNumberViewer
      {...createProps({
        verificationDisabled: true,
      })}
    />
  );
});

story.add('Safety Number Changed', () => {
  return (
    <SafetyNumberViewer
      {...createProps({
        safetyNumberChanged: true,
      })}
    />
  );
});

story.add('Safety Number (dialog close)', () => {
  return (
    <SafetyNumberViewer
      {...createProps({
        onClose: action('close'),
      })}
    />
  );
});

story.add('Just Profile and Number', () => {
  return (
    <SafetyNumberViewer
      {...createProps({
        contact: contactWithJustProfile,
      })}
    />
  );
});

story.add('Just Number', () => {
  return (
    <SafetyNumberViewer
      {...createProps({
        contact: contactWithJustNumber,
      })}
    />
  );
});

story.add('No Phone Number (cannot verify)', () => {
  return (
    <SafetyNumberViewer
      {...createProps({
        contact: contactWithNothing,
      })}
    />
  );
});
