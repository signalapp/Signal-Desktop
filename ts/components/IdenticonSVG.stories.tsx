// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { IdenticonSVG } from './IdenticonSVG';
import { AvatarColorMap } from '../types/Colors';

export default {
  title: 'Components/IdenticonSVG',
};

export const AllColors = (): JSX.Element => {
  const stories: Array<JSX.Element> = [];

  AvatarColorMap.forEach(value =>
    stories.push(
      <IdenticonSVG
        backgroundColor={value.bg}
        content="HI"
        foregroundColor={value.fg}
      />
    )
  );

  return <>{stories}</>;
};
