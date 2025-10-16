// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta, StoryFn } from '@storybook/react';

import type { PropsType } from './DonationThanksModal.dom.js';
import { DonationThanksModal } from './DonationThanksModal.dom.js';
import { getFakeBadge } from '../test-helpers/getFakeBadge.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DonationThanksModal',
  component: DonationThanksModal,
} satisfies Meta<PropsType>;

const donationBadge = getFakeBadge({ id: 'donation-badge' });

const defaultProps = {
  i18n,
  onClose: action('onClose'),
  badge: donationBadge,
  applyDonationBadge: ({
    onComplete,
  }: {
    badge: unknown;
    applyBadge: boolean;
    onComplete: (error?: Error) => void;
  }) => {
    action('applyDonationBadge')();
    // Simulate async badge application
    setTimeout(() => {
      onComplete();
    }, 500);
  },
};

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => <DonationThanksModal {...args} />;

export const Default = Template.bind({});
Default.args = defaultProps;

export const LoadingBadge = Template.bind({});
LoadingBadge.args = {
  ...defaultProps,
  badge: undefined,
};
