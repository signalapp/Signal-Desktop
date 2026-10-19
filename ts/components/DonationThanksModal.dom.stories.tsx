// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { ApplyDonationBadgeArgs } from './DonationThanksModal.dom.tsx';
import { DonationThanksModal } from './DonationThanksModal.dom.tsx';
import { getFakeBadge } from '../test-helpers/getFakeBadge.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DonationThanksModal',
} satisfies Meta;

const donationBadge = getFakeBadge({ id: 'donation-badge' });

function applyDonationBadge(args: ApplyDonationBadgeArgs): void {
  action('applyDonationBadge')(args);
  // Simulate async badge application
  setTimeout(() => {
    args.onComplete(null);
  }, 500);
}

export function Default(): ReactNode {
  return (
    <DonationThanksModal
      i18n={i18n}
      badge={donationBadge}
      applyDonationBadge={applyDonationBadge}
      onClose={action('onClose')}
    />
  );
}

export function LoadingBadge(): ReactNode {
  return (
    <DonationThanksModal
      i18n={i18n}
      badge={null}
      applyDonationBadge={applyDonationBadge}
      onClose={action('onClose')}
    />
  );
}
