// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { select } from '@storybook/addon-knobs';

import type { PropsType } from './Tooltip';
import { Tooltip, TooltipPlacement } from './Tooltip';
import { Theme } from '../util/theme';

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  content: overrideProps.content || 'Hello World',
  direction: select('direction', TooltipPlacement, overrideProps.direction),
  sticky: overrideProps.sticky,
  theme: overrideProps.theme,
});

export default {
  title: 'Components/Tooltip',
};

const Trigger = (
  <span
    style={{
      display: 'inline-block',
      marginTop: 200,
      marginBottom: 200,
      marginInlineStart: 200,
      marginInlineEnd: 200,
    }}
  >
    Trigger
  </span>
);

export const _Top = (): JSX.Element => (
  <Tooltip
    {...createProps({
      direction: TooltipPlacement.Top,
    })}
  >
    {Trigger}
  </Tooltip>
);

export const _Right = (): JSX.Element => (
  <Tooltip
    {...createProps({
      direction: TooltipPlacement.Right,
    })}
  >
    {Trigger}
  </Tooltip>
);

export const _Bottom = (): JSX.Element => (
  <Tooltip
    {...createProps({
      direction: TooltipPlacement.Bottom,
    })}
  >
    {Trigger}
  </Tooltip>
);

export const _Left = (): JSX.Element => (
  <Tooltip
    {...createProps({
      direction: TooltipPlacement.Left,
    })}
  >
    {Trigger}
  </Tooltip>
);

export function Sticky(): JSX.Element {
  return (
    <Tooltip
      {...createProps({
        sticky: true,
      })}
    >
      {Trigger}
    </Tooltip>
  );
}

export function WithAppliedPopperModifiers(): JSX.Element {
  return (
    <Tooltip
      {...createProps({
        direction: TooltipPlacement.Bottom,
      })}
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

export function DarkTheme(): JSX.Element {
  return (
    <Tooltip
      {...createProps({
        sticky: true,
        theme: Theme.Dark,
      })}
    >
      {Trigger}
    </Tooltip>
  );
}
