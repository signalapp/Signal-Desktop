// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './AddNewLines';
import { AddNewLines } from './AddNewLines';

export default {
  title: 'Components/Conversation/AddNewLines',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  renderNonNewLine: overrideProps.renderNonNewLine,
  text: overrideProps.text || '',
});

export function AllNewlines(): JSX.Element {
  const props = createProps({
    text: '\n\n\n',
  });

  return <AddNewLines {...props} />;
}

export function StartingEndingWithNewlines(): JSX.Element {
  const props = createProps({
    text: '\nSome text\n',
  });

  return <AddNewLines {...props} />;
}

export function NewlinesInTheMiddle(): JSX.Element {
  const props = createProps({
    text: 'Some\ntext',
  });

  return <AddNewLines {...props} />;
}

export function NoNewlines(): JSX.Element {
  const props = createProps({
    text: 'Some text',
  });

  return <AddNewLines {...props} />;
}

export function CustomRenderFunction(): JSX.Element {
  const props = createProps({
    text: 'Some text',
    renderNonNewLine: ({ text: theText, key }) => (
      <div key={key} style={{ color: 'aquamarine' }}>
        {theText}
      </div>
    ),
  });

  return <AddNewLines {...props} />;
}
