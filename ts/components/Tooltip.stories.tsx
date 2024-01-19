// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './Tooltip';
import { Tooltip, TooltipPlacement } from './Tooltip';
import { Theme } from '../util/theme';

export default {
  title: 'Components/Tooltip',
  argTypes: {
    content: { control: { type: 'text' } },
    direction: {
      control: { type: 'select' },
      options: Object.values(TooltipPlacement),
    },
    sticky: { control: { type: 'boolean' } },
    theme: {
      control: { type: 'select' },
      options: Object.keys(Theme),
      mappings: Theme,
    },
  },
  args: {
    content: 'Hello World',
    direction: TooltipPlacement.Top,
    sticky: false,
  },
  decorators: [
    (Story): JSX.Element => {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
          }}
        >
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<PropsType>;

const Trigger = (
  <span
    style={{
      display: 'inline-block',
      background: '#eee',
      padding: 20,
      borderRadius: 4,
    }}
  >
    Trigger
  </span>
);

export function Top(args: PropsType): JSX.Element {
  return (
    <Tooltip {...args} direction={TooltipPlacement.Top}>
      {Trigger}
    </Tooltip>
  );
}

export function Right(args: PropsType): JSX.Element {
  return (
    <Tooltip {...args} direction={TooltipPlacement.Right}>
      {Trigger}
    </Tooltip>
  );
}

export function Bottom(args: PropsType): JSX.Element {
  return (
    <Tooltip {...args} direction={TooltipPlacement.Bottom}>
      {Trigger}
    </Tooltip>
  );
}

export function Left(args: PropsType): JSX.Element {
  return (
    <Tooltip {...args} direction={TooltipPlacement.Left}>
      {Trigger}
    </Tooltip>
  );
}

export function Sticky(args: PropsType): JSX.Element {
  return (
    <Tooltip {...args} sticky>
      {Trigger}
    </Tooltip>
  );
}

export function WithAppliedPopperModifiers(args: PropsType): JSX.Element {
  return (
    <Tooltip
      {...args}
      direction={TooltipPlacement.Bottom}
      popperModifiers={[
        {
          name: 'offset',
          options: {
            offset: [80, 80],
          },
        },
      ]}
    >
      {Trigger}
    </Tooltip>
  );
}

export function DarkTheme(args: PropsType): JSX.Element {
  return (
    <Tooltip {...args} sticky theme={Theme.Dark}>
      {Trigger}
    </Tooltip>
  );
}
