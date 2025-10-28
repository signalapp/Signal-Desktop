// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './DonationInterruptedModal.dom.js';
import { DonationInterruptedModal } from './DonationInterruptedModal.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DonationInterruptedModal',
} satisfies Meta<PropsType>;

const defaultProps = {
  i18n,
  onCancelDonation: action('onCancelDonation'),
  onRetryDonation: action('onRetryDonation'),
};

export function Default(): JSX.Element {
  return <DonationInterruptedModal {...defaultProps} />;
}
