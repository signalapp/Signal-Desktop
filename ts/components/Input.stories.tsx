// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './Input';
import { Input } from './Input';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Input',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  disabled: Boolean(overrideProps.disabled),
  disableSpellcheck: overrideProps.disableSpellcheck,
  expandable: Boolean(overrideProps.expandable),
  hasClearButton: Boolean(overrideProps.hasClearButton),
  i18n,
  icon: overrideProps.icon,
  maxLengthCount: overrideProps.maxLengthCount,
  onChange: action('onChange'),
  placeholder: overrideProps.placeholder ?? 'Enter some text here',
  value: overrideProps.value ?? '',
  whenToShowRemainingCount: overrideProps.whenToShowRemainingCount,
});

function Controller(props: PropsType): JSX.Element {
  const { value: initialValue } = props;
  const [value, setValue] = useState(initialValue);

  return <Input {...props} onChange={setValue} value={value} />;
}

export function Simple(): JSX.Element {
  return <Controller {...createProps()} />;
}

export function HasClearButton(): JSX.Element {
  return (
    <Controller
      {...createProps({
        hasClearButton: true,
      })}
    />
  );
}

export function CharacterCount(): JSX.Element {
  return (
    <Controller
      {...createProps({
        maxLengthCount: 10,
      })}
    />
  );
}

export function CharacterCountCustomizableShow(): JSX.Element {
  return (
    <Controller
      {...createProps({
        maxLengthCount: 64,
        whenToShowRemainingCount: 32,
      })}
    />
  );
}

export function Expandable(): JSX.Element {
  return (
    <Controller
      {...createProps({
        expandable: true,
      })}
    />
  );
}

export function ExpandableWCount(): JSX.Element {
  return (
    <Controller
      {...createProps({
        expandable: true,
        hasClearButton: true,
        maxLengthCount: 140,
        whenToShowRemainingCount: 0,
      })}
    />
  );
}

export function Disabled(): JSX.Element {
  return (
    <Controller
      {...createProps({
        disabled: true,
      })}
    />
  );
}

export function SpellcheckDisabled(): JSX.Element {
  return (
    <Controller
      {...createProps({
        disableSpellcheck: true,
      })}
    />
  );
}
