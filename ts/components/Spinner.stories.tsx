// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './Spinner';
import { Spinner, SpinnerDirections, SpinnerSvgSizes } from './Spinner';

export default {
  title: 'Components/Spinner',
  argTypes: {
    size: { control: { type: 'text' } },
    svgSize: { control: { type: 'select' }, options: SpinnerSvgSizes },
    direction: { control: { type: 'select' }, options: SpinnerDirections },
  },
  args: {
    size: '20px',
    svgSize: 'normal',
    direction: undefined,
  },
} satisfies Meta<Props>;

export function Normal(args: Props): JSX.Element {
  return <Spinner {...args} />;
}

export function SvgSizes(args: Props): JSX.Element {
  return (
    <>
      {SpinnerSvgSizes.map(svgSize => (
        <Spinner key={svgSize} {...args} svgSize={svgSize} />
      ))}
    </>
  );
}

export function Directions(args: Props): JSX.Element {
  return (
    <>
      {SpinnerDirections.map(direction => (
        <Spinner key={direction} {...args} direction={direction} />
      ))}
    </>
  );
}
