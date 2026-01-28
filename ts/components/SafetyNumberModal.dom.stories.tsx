// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { getDefaultConversation } from '../test-helpers/getDefaultConversation.std.js';
import type { PropsType } from './SafetyNumberModal.dom.js';
import { SafetyNumberModal } from './SafetyNumberModal.dom.js';
import { SafetyNumber } from './SafetyNumberViewer.dom.stories.js';

const { i18n } = window.SignalContext;

const contactWithAllData = getDefaultConversation({
  id: 'abc',
  avatarUrl: undefined,
  profileName: '-*Smartest Dude*-',
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '(305) 123-4567',
});

function renderSafetyNumberViewer(): JSX.Element {
  return <SafetyNumber />;
}

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  i18n,
  contact: contactWithAllData,
  ...overrideProps,
  toggleSafetyNumberModal: action('toggle-safety-number-modal'),
  renderSafetyNumberViewer,
});

export default {
  title: 'Components/SafetyNumberModal',
} satisfies Meta<PropsType>;

export function Default(): React.JSX.Element {
  return <SafetyNumberModal {...createProps({})} />;
}
