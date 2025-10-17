// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './DonationProgressModal.dom.js';
import { DonationProgressModal } from './DonationProgressModal.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DonationProgressModal',
} satisfies Meta<PropsType>;

const defaultProps = {
  i18n,
  onWaitedTooLong: action('onWaitedTooLong'),
};

export function Default(): JSX.Element {
  return <DonationProgressModal {...defaultProps} />;
}
