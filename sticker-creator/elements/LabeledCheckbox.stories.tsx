import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';

import { StoryRow } from './StoryRow';
import { LabeledCheckbox } from './LabeledCheckbox';

storiesOf('Sticker Creator/elements', module).add('Labeled Checkbox', () => {
  const child = text('label', 'foo bar');
  const [checked, setChecked] = React.useState(false);

  return (
    <StoryRow>
      <LabeledCheckbox value={checked} onChange={setChecked}>
        {child}
      </LabeledCheckbox>
    </StoryRow>
  );
});
