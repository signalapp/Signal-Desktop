// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './DonationVerificationModal.dom.js';
import { DonationVerificationModal } from './DonationVerificationModal.dom.js';
import { SECOND } from '../util/durations/index.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DonationVerificationModal',
} satisfies Meta<PropsType>;

const defaultProps = {
  i18n,
  onCancelDonation: action('onCancelDonation'),
  onOpenBrowser: action('onOpenBrowser'),
  onTimedOut: action('onTimedOut'),
};

export function Default(): JSX.Element {
  return <DonationVerificationModal {...defaultProps} />;
}

export function FiveSecondTimeout(): JSX.Element {
  return <DonationVerificationModal {...defaultProps} _timeout={5 * SECOND} />;
}
