// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { DonationsReceiptDetailsDialog } from './DonationsReceiptDetailsDialog.dom.tsx';
import type { DonationReceipt } from '../types/Donations.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DonationsReceiptDetailsDialog',
} satisfies Meta;

const RECEIPT_USD: DonationReceipt = {
  id: '9f9288a1-acb6-4d21-a2f6-0b4d5a2e7d1c',
  currencyType: 'USD',
  paymentAmount: 1000,
  timestamp: new Date('2026-03-14T12:00:00Z').getTime(),
};

const RECEIPT_JPY: DonationReceipt = {
  id: '2c1f5b3e-6a4d-4e8b-9c0f-1d2e3f4a5b6c',
  currencyType: 'JPY',
  paymentAmount: 1000,
  timestamp: new Date('2025-11-02T12:00:00Z').getTime(),
};

export function Basic(): ReactNode {
  return (
    <DonationsReceiptDetailsDialog
      i18n={i18n}
      receipt={RECEIPT_USD}
      downloading={false}
      onDownload={action('onDownload')}
      onClose={action('onClose')}
    />
  );
}

export function ZeroDecimalCurrency(): ReactNode {
  return (
    <DonationsReceiptDetailsDialog
      i18n={i18n}
      receipt={RECEIPT_JPY}
      downloading={false}
      onDownload={action('onDownload')}
      onClose={action('onClose')}
    />
  );
}

export function Downloading(): ReactNode {
  return (
    <DonationsReceiptDetailsDialog
      i18n={i18n}
      receipt={RECEIPT_USD}
      downloading
      onDownload={action('onDownload')}
      onClose={action('onClose')}
    />
  );
}
