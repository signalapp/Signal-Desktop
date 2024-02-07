// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { Meta, StoryFn } from '@storybook/react';

import { action } from '@storybook/addon-actions';
import enMessages from '../../../_locales/en/messages.json';
import { setupI18n } from '../../util/setupI18n';
import { ThemeType } from '../../types/Util';
import { getDefaultConversation } from '../../test-both/helpers/getDefaultConversation';

import type { PropsType } from './ContactSpoofingReviewDialogPerson';
import { ContactSpoofingReviewDialogPerson } from './ContactSpoofingReviewDialogPerson';

const i18n = setupI18n('en', enMessages);

export default {
  component: ContactSpoofingReviewDialogPerson,
  title: 'Components/Conversation/ContactSpoofingReviewDialogPerson',
  argTypes: {
    oldName: { control: { type: 'text' } },
    isSignalConnection: { control: { type: 'boolean' } },
  },
  args: {
    i18n,
    onClick: action('onClick'),
    toggleSignalConnectionsModal: action('toggleSignalConnectionsModal'),
    updateSharedGroups: action('updateSharedGroups'),
    getPreferredBadge: () => undefined,
    conversation: getDefaultConversation(),
    theme: ThemeType.light,
    oldName: undefined,
    isSignalConnection: false,
  },
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = args => {
  return <ContactSpoofingReviewDialogPerson {...args} />;
};

export const Normal = Template.bind({});

export const SignalConnection = Template.bind({});
SignalConnection.args = {
  isSignalConnection: true,
};

export const ProfileNameChanged = Template.bind({});
ProfileNameChanged.args = {
  oldName: 'Imposter',
};

export const WithSharedGroups = Template.bind({});
WithSharedGroups.args = {
  conversation: getDefaultConversation({
    sharedGroupNames: ['A', 'B', 'C'],
  }),
};
