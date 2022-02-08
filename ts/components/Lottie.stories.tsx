// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';

import { Lottie } from './Lottie';

import testAnimationData from '../../fixtures/lottie-loader-by-lucas-bariani.json';

const STORYBOOK_CONTAINER_CLASS_NAME = 'lottie-test-storybook-container';

const story = storiesOf('Components/Lottie', module);

story.add('Default', () => (
  <Lottie
    animationData={testAnimationData}
    className={STORYBOOK_CONTAINER_CLASS_NAME}
    style={{ width: 300, height: 300 }}
  />
));
