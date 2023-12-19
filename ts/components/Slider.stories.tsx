// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './Slider';
import { Slider } from './Slider';

export default {
  title: 'Components/Slider',
} satisfies Meta<PropsType>;

const createProps = (): PropsType => ({
  label: 'Slider Handle',
  onChange: action('onChange'),
  value: 30,
});

export function Default(): JSX.Element {
  return <Slider {...createProps()} />;
}

function StatefulSliderController(props: PropsType): JSX.Element {
  const [value, setValue] = useState(30);

  return <Slider {...props} onChange={setValue} value={value} />;
}

export function DraggableTest(): JSX.Element {
  return <StatefulSliderController {...createProps()} />;
}
