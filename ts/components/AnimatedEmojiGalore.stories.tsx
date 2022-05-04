// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './AnimatedEmojiGalore';
import { AnimatedEmojiGalore } from './AnimatedEmojiGalore';

const story = storiesOf('Components/AnimatedEmojiGalore', module);

function getDefaultProps(): PropsType {
  return {
    emoji: '❤️',
    onAnimationEnd: action('onAnimationEnd'),
  };
}

story.add('Hearts', () => <AnimatedEmojiGalore {...getDefaultProps()} />);
