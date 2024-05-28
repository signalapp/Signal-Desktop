// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { Meta, StoryFn } from '@storybook/react';
import React from 'react';

import { action } from '@storybook/addon-actions';
import type { PropsType } from './LocalDeleteWarningModal';
import enMessages from '../../_locales/en/messages.json';
import { LocalDeleteWarningModal } from './LocalDeleteWarningModal';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/LocalDeleteWarningModal',
  component: LocalDeleteWarningModal,
  args: {
    i18n,
    onClose: action('onClose'),
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => (
  <LocalDeleteWarningModal {...args} />
);

export const Modal = Template.bind({});
Modal.args = {};
