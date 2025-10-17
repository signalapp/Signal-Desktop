// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './OutgoingGiftBadgeModal.dom.js';
import { OutgoingGiftBadgeModal } from './OutgoingGiftBadgeModal.dom.js';
import { BadgeCategory } from '../badges/BadgeCategory.std.js';

const { i18n } = window.SignalContext;

const getPreferredBadge = () => ({
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
});

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  recipientTitle: overrideProps.recipientTitle ?? 'Default Name',
  badgeId: overrideProps.badgeId ?? 'heart',
  getPreferredBadge,
  hideOutgoingGiftBadgeModal: action('hideOutgoingGiftBadgeModal'),
  i18n,
});

export default {
  title: 'Components/OutgoingGiftBadgeModal',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function Normal(): JSX.Element {
  return <OutgoingGiftBadgeModal {...createProps()} />;
}

export function MissingBadge(): JSX.Element {
  const props = {
    ...createProps(),
    getPreferredBadge: () => undefined,
  };

  return <OutgoingGiftBadgeModal {...props} />;
}
