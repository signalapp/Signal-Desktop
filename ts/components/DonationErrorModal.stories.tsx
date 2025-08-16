// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './DonationErrorModal';
import { DonationErrorModal } from './DonationErrorModal';
import { donationErrorTypeSchema } from '../types/Donations';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DonationErrorModal',
} satisfies Meta<PropsType>;

const defaultProps = {
  i18n,
  onClose: action('onClose'),
};

export function Failed3dsValidation(): JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.Enum.Failed3dsValidation}
    />
  );
}

export function GeneralError(): JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.Enum.GeneralError}
    />
  );
}

export function PaymentDeclined(): JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.Enum.PaymentDeclined}
    />
  );
}

export function TimedOut(): JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.Enum.TimedOut}
    />
  );
}
