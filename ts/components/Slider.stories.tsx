// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './Slider';
import { Slider } from './Slider';

const story = storiesOf('Components/Slider', module);

const createProps = (): PropsType => ({
  label: 'Slider Handle',
  onChange: action('onChange'),
  value: 30,
});

story.add('Default', () => <Slider {...createProps()} />);

story.add('Draggable Test', () => {
  function StatefulSliderController(props: PropsType): JSX.Element {
    const [value, setValue] = useState(30);

    return <Slider {...props} onChange={setValue} value={value} />;
  }

  return <StatefulSliderController {...createProps()} />;
});
