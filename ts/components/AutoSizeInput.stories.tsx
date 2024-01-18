// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './AutoSizeInput';
import { AutoSizeInput } from './AutoSizeInput';

export default {
  title: 'Components/AutoSizeInput',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  disabled: Boolean(overrideProps.disabled),
  disableSpellcheck: overrideProps.disableSpellcheck,
  onChange: action('onChange'),
  placeholder: overrideProps.placeholder ?? 'Enter some text here',
  value: overrideProps.value ?? '',
});

function Controller(props: PropsType): JSX.Element {
  const { value: initialValue } = props;
  const [value, setValue] = useState(initialValue);

  return <AutoSizeInput {...props} onChange={setValue} value={value} />;
}

export function Simple(): JSX.Element {
  return <Controller {...createProps()} />;
}
