// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';

import type { PropsType } from './SafetyNumberViewer';
import { SafetyNumberViewer } from './SafetyNumberViewer';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';

const i18n = setupI18n('en', enMessages);

const contactWithAllData = getDefaultConversation({
  title: 'Summer Smith',
  name: 'Summer Smith',
  phoneNumber: '(305) 123-4567',
  isVerified: true,
});

const contactWithJustProfile = getDefaultConversation({
  avatarPath: undefined,
  title: '-*Smartest Dude*-',
  profileName: '-*Smartest Dude*-',
  name: undefined,
  phoneNumber: '(305) 123-4567',
});

const contactWithJustNumber = getDefaultConversation({
  avatarPath: undefined,
  profileName: undefined,
  name: undefined,
  title: '(305) 123-4567',
  phoneNumber: '(305) 123-4567',
});

const contactWithNothing = getDefaultConversation({
  id: 'some-guid',
  avatarPath: undefined,
  profileName: undefined,
  title: 'Unknown contact',
  name: undefined,
  phoneNumber: undefined,
});

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  contact: overrideProps.contact || contactWithAllData,
  generateSafetyNumber: action('generate-safety-number'),
  i18n,
  safetyNumber: text('safetyNumber', overrideProps.safetyNumber || 'XXX'),
  toggleVerified: action('toggle-verified'),
  verificationDisabled: boolean(
    'verificationDisabled',
    overrideProps.verificationDisabled !== undefined
      ? overrideProps.verificationDisabled
      : false
  ),
  onClose: action('onClose'),
});

export default {
  title: 'Components/SafetyNumberViewer',
};

export const SafetyNumber = (): JSX.Element => {
  return <SafetyNumberViewer {...createProps({})} />;
};

export const SafetyNumberNotVerified = (): JSX.Element => {
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
};

SafetyNumberNotVerified.story = {
  name: 'Safety Number (not verified)',
};

export const VerificationDisabled = (): JSX.Element => {
  return (
    <SafetyNumberViewer
      {...createProps({
        verificationDisabled: true,
      })}
    />
  );
};

export const SafetyNumberDialogClose = (): JSX.Element => {
  return (
    <SafetyNumberViewer
      {...createProps({
        onClose: action('close'),
      })}
    />
  );
};

SafetyNumberDialogClose.story = {
  name: 'Safety Number (dialog close)',
};

export const JustProfileAndNumber = (): JSX.Element => {
  return (
    <SafetyNumberViewer
      {...createProps({
        contact: contactWithJustProfile,
      })}
    />
  );
};

JustProfileAndNumber.story = {
  name: 'Just Profile and Number',
};

export const JustNumber = (): JSX.Element => {
  return (
    <SafetyNumberViewer
      {...createProps({
        contact: contactWithJustNumber,
      })}
    />
  );
};

export const NoPhoneNumberCannotVerify = (): JSX.Element => {
  return (
    <SafetyNumberViewer
      {...createProps({
        contact: contactWithNothing,
      })}
    />
  );
};

NoPhoneNumberCannotVerify.story = {
  name: 'No Phone Number (cannot verify)',
};
