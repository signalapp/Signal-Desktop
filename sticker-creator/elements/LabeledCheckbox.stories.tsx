// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { LabeledCheckbox } from './LabeledCheckbox';

export default {
  title: 'Sticker Creator/elements',
};

export const _LabeledCheckbox = (): JSX.Element => {
  const child = text('label', 'foo bar');
  const [checked, setChecked] = React.useState(false);

  return (
    <StoryRow>
      <LabeledCheckbox value={checked} onChange={setChecked}>
        {child}
      </LabeledCheckbox>
    </StoryRow>
  );
};
