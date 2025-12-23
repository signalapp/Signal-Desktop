// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta } from '@storybook/react';
import {
  IdenticonSVGForCallLink,
  IdenticonSVGForContact,
  IdenticonSVGForGroup,
} from './IdenticonSVG.dom.js';
import { AvatarColorMap } from '../types/Colors.std.js';

export default {
  title: 'Components/IdenticonSVG',
} satisfies Meta;

export function AllColorsForContact(): React.JSX.Element {
  const stories: Array<React.JSX.Element> = [];

  AvatarColorMap.forEach(value =>
    stories.push(
      <IdenticonSVGForContact
        backgroundColor={value.bg}
        text="HI"
        foregroundColor={value.fg}
      />
    )
  );

  return <>{stories}</>;
}

export function AllColorsForGroup(): React.JSX.Element {
  const stories: Array<React.JSX.Element> = [];

  AvatarColorMap.forEach(value =>
    stories.push(
      <IdenticonSVGForGroup
        backgroundColor={value.bg}
        foregroundColor={value.fg}
      />
    )
  );

  return <>{stories}</>;
}

export function AllColorsForCallLink(): React.JSX.Element {
  const stories: Array<React.JSX.Element> = [];

  AvatarColorMap.forEach(value =>
    stories.push(
      <IdenticonSVGForCallLink
        backgroundColor={value.bg}
        foregroundColor={value.fg}
      />
    )
  );

  return <>{stories}</>;
}
