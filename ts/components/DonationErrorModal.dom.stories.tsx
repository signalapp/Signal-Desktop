// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './DonationErrorModal.dom.tsx';
import { DonationErrorModal } from './DonationErrorModal.dom.tsx';
import { donationErrorTypeSchema } from '../types/Donations.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DonationErrorModal',
} satisfies Meta<PropsType>;

const defaultProps = {
  i18n,
  onClose: action('onClose'),
};

export function Failed3dsValidation(): React.JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.Failed3dsValidation}
    />
  );
}

export function GeneralError(): React.JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.GeneralError}
    />
  );
}

export function PaymentDeclined(): React.JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.PaymentDeclined}
    />
  );
}

export function PaypalCanceled(): React.JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.PaypalCanceled}
    />
  );
}

export function PaypalError(): React.JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.PaypalError}
    />
  );
}

export function TimedOut(): React.JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.TimedOut}
    />
  );
}
