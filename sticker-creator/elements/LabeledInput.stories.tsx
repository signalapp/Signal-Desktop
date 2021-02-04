// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { LabeledInput } from './LabeledInput';

storiesOf('Sticker Creator/elements', module).add('LabeledInput', () => {
  const child = text('label', 'foo bar');
  const placeholder = text('placeholder', 'foo bar');
  const [value, setValue] = React.useState('');

  return (
    <StoryRow>
      <LabeledInput value={value} onChange={setValue} placeholder={placeholder}>
        {child}
      </LabeledInput>
    </StoryRow>
  );
});
