// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { text } from '@storybook/addon-knobs';

import type { Props } from './AddNewLines';
import { AddNewLines } from './AddNewLines';

export default {
  title: 'Components/Conversation/AddNewLines',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  renderNonNewLine: overrideProps.renderNonNewLine,
  text: text('text', overrideProps.text || ''),
});

export const AllNewlines = (): JSX.Element => {
  const props = createProps({
    text: '\n\n\n',
  });

  return <AddNewLines {...props} />;
};

AllNewlines.story = {
  name: 'All newlines',
};

export const StartingEndingWithNewlines = (): JSX.Element => {
  const props = createProps({
    text: '\nSome text\n',
  });

  return <AddNewLines {...props} />;
};

StartingEndingWithNewlines.story = {
  name: 'Starting/Ending with Newlines',
};

export const NewlinesInTheMiddle = (): JSX.Element => {
  const props = createProps({
    text: 'Some\ntext',
  });

  return <AddNewLines {...props} />;
};

NewlinesInTheMiddle.story = {
  name: 'Newlines in the Middle',
};

export const NoNewlines = (): JSX.Element => {
  const props = createProps({
    text: 'Some text',
  });

  return <AddNewLines {...props} />;
};

export const CustomRenderFunction = (): JSX.Element => {
  const props = createProps({
    text: 'Some text',
    renderNonNewLine: ({ text: theText, key }) => (
      <div key={key} style={{ color: 'aquamarine' }}>
        {theText}
      </div>
    ),
  });

  return <AddNewLines {...props} />;
};
