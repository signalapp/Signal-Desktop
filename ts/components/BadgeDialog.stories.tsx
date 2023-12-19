// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { getFakeBadge, getFakeBadges } from '../test-both/helpers/getFakeBadge';
import { repeat, zipObject } from '../util/iterables';
import { BadgeImageTheme } from '../badges/BadgeImageTheme';
import type { PropsType } from './BadgeDialog';
import { BadgeDialog } from './BadgeDialog';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/BadgeDialog',
} satisfies Meta<PropsType>;

const defaultProps: ComponentProps<typeof BadgeDialog> = {
  areWeASubscriber: false,
  badges: getFakeBadges(3),
  firstName: 'Alice',
  i18n,
  onClose: action('onClose'),
  title: 'Alice Levine',
};

export function NoBadgesClosedImmediately(): JSX.Element {
  return <BadgeDialog {...defaultProps} badges={[]} />;
}

export function OneBadge(): JSX.Element {
  return <BadgeDialog {...defaultProps} badges={getFakeBadges(1)} />;
}

export function BadgeWithNoImageShouldBeImpossible(): JSX.Element {
  return (
    <BadgeDialog
      {...defaultProps}
      badges={[
        {
          ...getFakeBadge(),
          images: [],
        },
      ]}
    />
  );
}

export function BadgeWithPendingImage(): JSX.Element {
  return (
    <BadgeDialog
      {...defaultProps}
      badges={[
        {
          ...getFakeBadge(),
          images: Array(4).fill(
            zipObject(
              Object.values(BadgeImageTheme),
              repeat({ url: 'https://example.com/ignored.svg' })
            )
          ),
        },
      ]}
    />
  );
}

export function BadgeWithOnlyOneLowDetailImage(): JSX.Element {
  return (
    <BadgeDialog
      {...defaultProps}
      badges={[
        {
          ...getFakeBadge(),
          images: [
            zipObject(
              Object.values(BadgeImageTheme),
              repeat({
                localPath: '/fixtures/orange-heart.svg',
                url: 'https://example.com/ignored.svg',
              })
            ),
            ...Array(3).fill(
              zipObject(
                Object.values(BadgeImageTheme),
                repeat({ url: 'https://example.com/ignored.svg' })
              )
            ),
          ],
        },
      ]}
    />
  );
}

export function FiveBadges(): JSX.Element {
  return <BadgeDialog {...defaultProps} badges={getFakeBadges(5)} />;
}

export function ManyBadges(): JSX.Element {
  return <BadgeDialog {...defaultProps} badges={getFakeBadges(50)} />;
}

export function ManyBadgesUserIsASubscriber(): JSX.Element {
  return (
    <BadgeDialog
      {...defaultProps}
      areWeASubscriber
      badges={getFakeBadges(50)}
    />
  );
}
