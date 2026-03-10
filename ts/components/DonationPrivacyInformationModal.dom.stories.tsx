// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import { DonationPrivacyInformationModal } from './DonationPrivacyInformationModal.dom.js';
import type { LocalizerType } from '../types/I18N.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DonationPrivacyInformationModal',
} satisfies Meta<{ i18n: LocalizerType; onClose: VoidFunction }>;

export function Default(): React.JSX.Element {
  return (
    <DonationPrivacyInformationModal i18n={i18n} onClose={action('onClose')} />
  );
}
