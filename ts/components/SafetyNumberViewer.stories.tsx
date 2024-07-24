// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './SafetyNumberViewer';
import { SafetyNumberViewer } from './SafetyNumberViewer';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';

function generateQRData() {
  const data = new Uint8Array(128);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.floor(Math.random() * 256);
  }
  return data;
}

function generateNumberBlocks() {
  const result = new Array<string>();
  for (let i = 0; i < 12; i += 1) {
    let digits = '';
    for (let j = 0; j < 5; j += 1) {
      digits += Math.floor(Math.random() * 10);
    }
    result.push(digits);
  }
  return result;
}

const i18n = setupI18n('en', enMessages);

const contactWithAllData = getDefaultConversation({
  title: 'Summer Smith',
  name: 'Summer Smith',
  phoneNumber: '(305) 123-4567',
  isVerified: true,
});

const contactWithJustProfile = getDefaultConversation({
  avatarUrl: undefined,
  title: '-*Smartest Dude*-',
  profileName: '-*Smartest Dude*-',
  name: undefined,
  phoneNumber: '(305) 123-4567',
});

const contactWithJustNumber = getDefaultConversation({
  avatarUrl: undefined,
  profileName: undefined,
  name: undefined,
  title: '(305) 123-4567',
  phoneNumber: '(305) 123-4567',
});

const contactWithNothing = getDefaultConversation({
  id: 'some-guid',
  avatarUrl: undefined,
  profileName: undefined,
  title: 'Unknown contact',
  name: undefined,
  phoneNumber: undefined,
});

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  contact: overrideProps.contact || contactWithAllData,
  generateSafetyNumber: action('generate-safety-number'),
  i18n,
  safetyNumber:
    'safetyNumber' in overrideProps
      ? (overrideProps.safetyNumber ?? null)
      : {
          numberBlocks: generateNumberBlocks(),
          qrData: generateQRData(),
        },
  toggleVerified: action('toggle-verified'),
  verificationDisabled:
    overrideProps.verificationDisabled !== undefined
      ? overrideProps.verificationDisabled
      : false,
  onClose: action('onClose'),
});

export default {
  title: 'Components/SafetyNumberViewer',
} satisfies Meta<PropsType>;

export function SafetyNumber(): JSX.Element {
  return <SafetyNumberViewer {...createProps({})} />;
}

export function SafetyNumberNotVerified(): JSX.Element {
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
}

export function VerificationDisabled(): JSX.Element {
  return (
    <SafetyNumberViewer
      {...createProps({
        verificationDisabled: true,
      })}
    />
  );
}

export function SafetyNumberDialogClose(): JSX.Element {
  return (
    <SafetyNumberViewer
      {...createProps({
        onClose: action('close'),
      })}
    />
  );
}

export function JustProfileAndNumber(): JSX.Element {
  return (
    <SafetyNumberViewer
      {...createProps({
        contact: contactWithJustProfile,
      })}
    />
  );
}

export function JustNumber(): JSX.Element {
  return (
    <SafetyNumberViewer
      {...createProps({
        contact: contactWithJustNumber,
      })}
    />
  );
}

export function NoACICannotVerify(): JSX.Element {
  return (
    <SafetyNumberViewer
      {...createProps({
        contact: contactWithNothing,
        safetyNumber: undefined,
      })}
    />
  );
}
