// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

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

export function Failed3dsValidation(): JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.Failed3dsValidation}
    />
  );
}

export function GeneralError(): JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.GeneralError}
    />
  );
}

export function PaymentDeclined(): JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.PaymentDeclined}
    />
  );
}

export function PaypalCanceled(): JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.PaypalCanceled}
    />
  );
}

export function PaypalError(): JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.PaypalError}
    />
  );
}

export function TimedOut(): JSX.Element {
  return (
    <DonationErrorModal
      {...defaultProps}
      errorType={donationErrorTypeSchema.enum.TimedOut}
    />
  );
}
