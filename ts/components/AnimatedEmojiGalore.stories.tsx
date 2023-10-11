// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './AnimatedEmojiGalore';
import { AnimatedEmojiGalore } from './AnimatedEmojiGalore';

export default {
  title: 'Components/AnimatedEmojiGalore',
} satisfies Meta<PropsType>;

function getDefaultProps(): PropsType {
  return {
    emoji: '❤️',
    onAnimationEnd: action('onAnimationEnd'),
  };
}

export function Hearts(): JSX.Element {
  return <AnimatedEmojiGalore {...getDefaultProps()} />;
}
