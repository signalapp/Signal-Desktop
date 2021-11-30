// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComponentProps } from 'react';
import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { getFakeBadge, getFakeBadges } from '../test-both/helpers/getFakeBadge';
import { repeat, zipObject } from '../util/iterables';
import { BadgeImageTheme } from '../badges/BadgeImageTheme';
import { BadgeDialog } from './BadgeDialog';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/BadgeDialog', module);

const defaultProps: ComponentProps<typeof BadgeDialog> = {
  areWeASubscriber: false,
  badges: getFakeBadges(3),
  firstName: 'Alice',
  i18n,
  onClose: action('onClose'),
  title: 'Alice Levine',
};

story.add('No badges (closed immediately)', () => (
  <BadgeDialog {...defaultProps} badges={[]} />
));

story.add('One badge', () => (
  <BadgeDialog {...defaultProps} badges={getFakeBadges(1)} />
));

story.add('Badge with no image (should be impossible)', () => (
  <BadgeDialog
    {...defaultProps}
    badges={[
      {
        ...getFakeBadge(),
        images: [],
      },
    ]}
  />
));

story.add('Badge with pending image', () => (
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
));

story.add('Badge with only one, low-detail image', () => (
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
));

story.add('Five badges', () => (
  <BadgeDialog {...defaultProps} badges={getFakeBadges(5)} />
));

story.add('Many badges', () => (
  <BadgeDialog {...defaultProps} badges={getFakeBadges(50)} />
));

story.add('Many badges, user is a subscriber', () => (
  <BadgeDialog {...defaultProps} areWeASubscriber badges={getFakeBadges(50)} />
));
