// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './DonationVerificationModal';
import { DonationVerificationModal } from './DonationVerificationModal';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DonationVerificationModal',
} satisfies Meta<PropsType>;

const defaultProps = {
  i18n,
  onCancel: action('onCancel'),
  onOpenBrowser: action('onOpenBrowser'),
};

export function Default(): JSX.Element {
  return <DonationVerificationModal {...defaultProps} />;
}
