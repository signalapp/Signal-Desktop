// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';

import { IdenticonSVG } from './IdenticonSVG';
import { AvatarColorMap } from '../types/Colors';

const story = storiesOf('Components/IdenticonSVG', module);

AvatarColorMap.forEach((value, key) =>
  story.add(key, () => (
    <IdenticonSVG
      backgroundColor={value.bg}
      content="HI"
      foregroundColor={value.fg}
    />
  ))
);
