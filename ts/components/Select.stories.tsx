// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';

import { Select } from './Select';

export default {
  title: 'Components/Select',
};

export const Normal = (): JSX.Element => {
  const [value, setValue] = useState(0);

  const onChange = action('onChange');

  return (
    <Select
      options={[
        { value: 1, text: '1' },
        { value: 2, text: '2' },
        { value: 3, text: '3' },
      ]}
      value={value}
      onChange={newValue => {
        onChange(newValue);
        setValue(parseInt(newValue, 10));
      }}
    />
  );
};

export const WithDisabledOptions = (): JSX.Element => (
  <Select
    options={[
      { value: 'a', text: 'Apples' },
      { value: 'b', text: 'Bananas', disabled: true },
      { value: 'c', text: 'Cabbage' },
      { value: 'd', text: 'Durian', disabled: true },
    ]}
    onChange={action('onChange')}
    value="c"
  />
);

WithDisabledOptions.story = {
  name: 'With disabled options',
};
