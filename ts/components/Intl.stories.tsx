// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, Story } from '@storybook/react';
import * as React from 'react';

import type { Props } from './Intl';
import { Intl } from './Intl';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Intl',
  component: Intl,
} as Meta;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  id: overrideProps.id || '',
  components: overrideProps.components,
  renderText: overrideProps.renderText,
});

const Template: Story<Props> = args => <Intl {...args} />;

export const NoReplacements = Template.bind({});
NoReplacements.args = createProps({
  id: 'deleteAndRestart',
});

export const SingleStringReplacement = Template.bind({});
SingleStringReplacement.args = createProps({
  id: 'leftTheGroup',
  components: ['Theodora'],
});

export const SingleTagReplacement = Template.bind({});
SingleTagReplacement.args = createProps({
  id: 'leftTheGroup',
  components: [
    <button type="button" key="a-button">
      Theodora
    </button>,
  ],
});

export const MultipleStringReplacement = Template.bind({});
MultipleStringReplacement.args = createProps({
  id: 'changedRightAfterVerify',
  components: {
    name1: 'Fred',
    name2: 'The Fredster',
  },
});

export const MultipleTagReplacement = Template.bind({});
MultipleTagReplacement.args = createProps({
  id: 'changedRightAfterVerify',
  components: {
    name1: <b>Fred</b>,
    name2: <b>The Fredster</b>,
  },
});

export const CustomRender = Template.bind({});
CustomRender.args = createProps({
  id: 'deleteAndRestart',
  renderText: ({ text: theText, key }) => (
    <div style={{ backgroundColor: 'purple', color: 'orange' }} key={key}>
      {theText}
    </div>
  ),
});
