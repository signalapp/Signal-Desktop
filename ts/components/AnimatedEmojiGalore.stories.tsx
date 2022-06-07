// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './AnimatedEmojiGalore';
import { AnimatedEmojiGalore } from './AnimatedEmojiGalore';

export default {
  title: 'Components/AnimatedEmojiGalore',
};

function getDefaultProps(): PropsType {
  return {
    emoji: '❤️',
    onAnimationEnd: action('onAnimationEnd'),
  };
}

export const Hearts = (): JSX.Element => (
  <AnimatedEmojiGalore {...getDefaultProps()} />
);
