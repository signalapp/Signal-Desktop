// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import { AvatarColors } from '../types/Colors.std.js';
import type { PropsType } from './BetterAvatarBubble.dom.js';
import { BetterAvatarBubble } from './BetterAvatarBubble.dom.js';

const { i18n } = window.SignalContext;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  children: overrideProps.children,
  color: overrideProps.color,
  i18n,
  isSelected: Boolean(overrideProps.isSelected),
  onDelete: action('onDelete'),
  onSelect: action('onSelect'),
  style: overrideProps.style,
});

export default {
  title: 'Components/BetterAvatarBubble',
} satisfies Meta<PropsType>;

export function Children(): JSX.Element {
  return (
    <BetterAvatarBubble
      {...createProps({
        children: <div>HI</div>,
        color: AvatarColors[8],
      })}
    />
  );
}

export function Selected(): JSX.Element {
  return (
    <BetterAvatarBubble
      {...createProps({
        color: AvatarColors[1],
        isSelected: true,
      })}
    />
  );
}

export function Style(): JSX.Element {
  return (
    <BetterAvatarBubble
      {...createProps({
        style: {
          height: 120,
          width: 120,
        },
        color: AvatarColors[2],
      })}
    />
  );
}
