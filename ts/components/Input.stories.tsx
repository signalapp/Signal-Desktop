// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './Input';
import { Input } from './Input';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const stories = storiesOf('Components/Input', module);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  disabled: Boolean(overrideProps.disabled),
  expandable: Boolean(overrideProps.expandable),
  hasClearButton: Boolean(overrideProps.hasClearButton),
  i18n,
  icon: overrideProps.icon,
  maxLengthCount: overrideProps.maxLengthCount,
  onChange: action('onChange'),
  placeholder: text(
    'placeholder',
    overrideProps.placeholder || 'Enter some text here'
  ),
  value: text('value', overrideProps.value || ''),
  whenToShowRemainingCount: overrideProps.whenToShowRemainingCount,
});

function Controller(props: PropsType): JSX.Element {
  const { value: initialValue } = props;
  const [value, setValue] = useState(initialValue);

  return <Input {...props} onChange={setValue} value={value} />;
}

stories.add('Simple', () => <Controller {...createProps()} />);

stories.add('hasClearButton', () => (
  <Controller
    {...createProps({
      hasClearButton: true,
    })}
  />
));

stories.add('character count', () => (
  <Controller
    {...createProps({
      maxLengthCount: 10,
    })}
  />
));

stories.add('character count (customizable show)', () => (
  <Controller
    {...createProps({
      maxLengthCount: 64,
      whenToShowRemainingCount: 32,
    })}
  />
));

stories.add('expandable', () => (
  <Controller
    {...createProps({
      expandable: true,
    })}
  />
));

stories.add('expandable w/count', () => (
  <Controller
    {...createProps({
      expandable: true,
      hasClearButton: true,
      maxLengthCount: 140,
      whenToShowRemainingCount: 0,
    })}
  />
));

stories.add('disabled', () => (
  <Controller
    {...createProps({
      disabled: true,
    })}
  />
));
