// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, Story } from '@storybook/react';

import type { Props } from './AddUserToAnotherGroupModal';
import enMessages from '../../_locales/en/messages.json';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import { AddUserToAnotherGroupModal } from './AddUserToAnotherGroupModal';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/AddUserToAnotherGroupModal',
  component: AddUserToAnotherGroupModal,
  argTypes: {
    candidateConversations: {
      defaultValue: Array.from(Array(100), () => getDefaultGroup()),
    },
    contact: {
      defaultValue: getDefaultConversation(),
    },
    i18n: {
      defaultValue: i18n,
    },
    addMembersToGroup: { action: true },
    toggleAddUserToAnotherGroupModal: { action: true },
  },
} as Meta;

// eslint-disable-next-line react/function-component-definition
const Template: Story<Props> = args => (
  <AddUserToAnotherGroupModal
    {...args}
    theme={React.useContext(StorybookThemeContext)}
  />
);

export const Modal = Template.bind({});
Modal.args = {};
