// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import enMessages from '../../_locales/en/messages.json';
import { AvatarColors } from '../types/Colors';
import type { PropsType } from './BetterAvatarBubble';
import { BetterAvatarBubble } from './BetterAvatarBubble';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  children: overrideProps.children,
  color: overrideProps.color,
  i18n,
  isSelected: Boolean(overrideProps.isSelected),
  onDelete: action('onDelete'),
  onSelect: action('onSelect'),
  style: overrideProps.style,
});

const story = storiesOf('Components/BetterAvatarBubble', module);

story.add('Children', () => (
  <BetterAvatarBubble
    {...createProps({
      children: <div>HI</div>,
      color: AvatarColors[8],
    })}
  />
));

story.add('Selected', () => (
  <BetterAvatarBubble
    {...createProps({
      color: AvatarColors[1],
      isSelected: true,
    })}
  />
));

story.add('Style', () => (
  <BetterAvatarBubble
    {...createProps({
      style: {
        height: 120,
        width: 120,
      },
      color: AvatarColors[2],
    })}
  />
));
