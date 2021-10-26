// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { select, text } from '@storybook/addon-knobs';
import type { Props } from './Spinner';
import { Spinner, SpinnerDirections, SpinnerSvgSizes } from './Spinner';

const story = storiesOf('Components/Spinner', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  size: text('size', overrideProps.size || ''),
  svgSize: select(
    'svgSize',
    SpinnerSvgSizes.reduce((m, s) => ({ ...m, [s]: s }), {}),
    overrideProps.svgSize || 'normal'
  ),
  direction: select(
    'direction',
    SpinnerDirections.reduce((d, s) => ({ ...d, [s]: s }), {}),
    overrideProps.direction
  ),
});

story.add('Normal', () => {
  const props = createProps();

  return <Spinner {...props} />;
});

story.add('SVG Sizes', () => {
  const props = createProps();

  return SpinnerSvgSizes.map(svgSize => (
    <Spinner key={svgSize} {...props} svgSize={svgSize} />
  ));
});

story.add('Directions', () => {
  const props = createProps();

  return SpinnerDirections.map(direction => (
    <Spinner key={direction} {...props} direction={direction} />
  ));
});
