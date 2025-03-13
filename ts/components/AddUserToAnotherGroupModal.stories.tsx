// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import type { Props } from './AddUserToAnotherGroupModal';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../test-both/helpers/getDefaultConversation';
import { AddUserToAnotherGroupModal } from './AddUserToAnotherGroupModal';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/AddUserToAnotherGroupModal',
  component: AddUserToAnotherGroupModal,
  args: {
    i18n,
    candidateConversations: Array.from(Array(100), () => getDefaultGroup()),
    contact: getDefaultConversation(),
  },
} satisfies Meta<Props>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<Props> = args => {
  return (
    <AddUserToAnotherGroupModal
      {...args}
      addMembersToGroup={action('addMembersToGroup')}
      toggleAddUserToAnotherGroupModal={action(
        'toggleAddUserToAnotherGroupModal'
      )}
    />
  );
};

export const Modal = Template.bind({});
