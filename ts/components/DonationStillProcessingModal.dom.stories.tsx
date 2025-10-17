// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './DonationStillProcessingModal.dom.js';
import { DonationStillProcessingModal } from './DonationStillProcessingModal.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DonationStillProcessingModal',
} satisfies Meta<PropsType>;

const defaultProps = {
  i18n,
  onClose: action('onClose'),
};

export function Default(): JSX.Element {
  return <DonationStillProcessingModal {...defaultProps} />;
}
