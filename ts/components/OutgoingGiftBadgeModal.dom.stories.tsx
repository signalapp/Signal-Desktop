// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { OutgoingGiftBadgeModal } from './OutgoingGiftBadgeModal.dom.tsx';
import { BadgeCategory } from '../badges/BadgeCategory.std.ts';
import type { BadgeType } from '../badges/types.std.ts';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/OutgoingGiftBadgeModal',
} satisfies Meta;

function getPreferredBadge(): BadgeType {
  return {
    category: BadgeCategory.Donor,
    descriptionTemplate: 'This is a description of the badge',
    id: 'BOOST-3',
    images: [
      {
        transparent: {
          localPath: '/fixtures/orange-heart.svg',
          url: 'http://someplace',
        },
      },
    ],
    name: 'heart',
  };
}

export function Normal(): ReactNode {
  return (
    <OutgoingGiftBadgeModal
      i18n={i18n}
      badgeId="heart"
      getPreferredBadge={getPreferredBadge}
      recipientTitle="Jamie"
      onClose={action('onClose')}
    />
  );
}

export function MissingBadge(): ReactNode {
  return (
    <OutgoingGiftBadgeModal
      i18n={i18n}
      badgeId="heart"
      getPreferredBadge={() => undefined}
      recipientTitle="Jamie"
      onClose={action('onClose')}
    />
  );
}
