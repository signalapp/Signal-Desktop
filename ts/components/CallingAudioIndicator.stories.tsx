// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';

import { CallingAudioIndicator } from './CallingAudioIndicator';

const story = storiesOf('Components/CallingAudioIndicator', module);

story.add('Default', () => (
  <CallingAudioIndicator
    hasAudio={boolean('hasAudio', true)}
    audioLevel={select('audioLevel', [0, 0.25, 0.5, 0.75, 1], 0.5)}
  />
));
