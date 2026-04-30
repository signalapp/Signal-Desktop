// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import type { Meta } from '@storybook/react';
import {
  IdenticonSVGForCallLink,
  IdenticonSVGForContact,
  IdenticonSVGForGroup,
} from './IdenticonSVG.dom.tsx';
import { AvatarColorMap } from '../types/Colors.std.ts';

export default {
  title: 'Components/IdenticonSVG',
} satisfies Meta;

export function AllColorsForContact(): JSX.Element {
  const stories: Array<JSX.Element> = [];

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

export function AllColorsForGroup(): JSX.Element {
  const stories: Array<JSX.Element> = [];

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

export function AllColorsForCallLink(): JSX.Element {
  const stories: Array<JSX.Element> = [];

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
