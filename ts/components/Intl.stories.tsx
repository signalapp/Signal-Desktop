// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import * as React from 'react';

import type { Props } from './Intl';
import { Intl } from './Intl';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Intl',
  component: Intl,
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  id: overrideProps.id || '',
  components: overrideProps.components,
});

// eslint-disable-next-line max-len
// eslint-disable-next-line react/function-component-definition, local-rules/valid-i18n-keys
const Template: StoryFn<Props> = args => <Intl {...args} />;

export const NoReplacements = Template.bind({});
NoReplacements.args = createProps({
  id: 'icu:deleteAndRestart',
});

export const SingleStringReplacement = Template.bind({});
SingleStringReplacement.args = createProps({
  id: 'icu:leftTheGroup',
  components: { name: 'Theodora' },
});

export const SingleTagReplacement = Template.bind({});
SingleTagReplacement.args = createProps({
  id: 'icu:leftTheGroup',
  components: {
    name: (
      <button type="button" key="a-button">
        Theodora
      </button>
    ),
  },
});

export const MultipleStringReplacement = Template.bind({});
MultipleStringReplacement.args = createProps({
  id: 'icu:changedRightAfterVerify',
  components: {
    name1: 'Fred',
    name2: 'The Fredster',
  },
});

export const MultipleTagReplacement = Template.bind({});
MultipleTagReplacement.args = createProps({
  id: 'icu:changedRightAfterVerify',
  components: {
    name1: <b>Fred</b>,
    name2: <b>The Fredster</b>,
  },
});

export function Emoji(): JSX.Element {
  const customI18n = setupI18n('en', {
    'icu:emoji': {
      messageformat: '<emojify>👋</emojify> Hello, world!',
    },
  });

  return (
    // eslint-disable-next-line local-rules/valid-i18n-keys
    <Intl i18n={customI18n} id="icu:emoji" />
  );
}
