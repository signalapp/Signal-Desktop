// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import type { Props } from './AddNewLines';
import { AddNewLines } from './AddNewLines';

const story = storiesOf('Components/Conversation/AddNewLines', module);
const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  renderNonNewLine: overrideProps.renderNonNewLine,
  text: text('text', overrideProps.text || ''),
});

story.add('All newlines', () => {
  const props = createProps({
    text: '\n\n\n',
  });

  return <AddNewLines {...props} />;
});

story.add('Starting/Ending with Newlines', () => {
  const props = createProps({
    text: '\nSome text\n',
  });

  return <AddNewLines {...props} />;
});

story.add('Newlines in the Middle', () => {
  const props = createProps({
    text: 'Some\ntext',
  });

  return <AddNewLines {...props} />;
});

story.add('No Newlines', () => {
  const props = createProps({
    text: 'Some text',
  });

  return <AddNewLines {...props} />;
});

story.add('Custom Render Function', () => {
  const props = createProps({
    text: 'Some text',
    renderNonNewLine: ({ text: theText, key }) => (
      <div key={key} style={{ color: 'aquamarine' }}>
        {theText}
      </div>
    ),
  });

  return <AddNewLines {...props} />;
});
