// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useContext } from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta, StoryFn } from '@storybook/react';

import { PreferencesSelectChatsDialog } from './PreferencesSelectChatsDialog.dom.tsx';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../../test-helpers/getDefaultConversation.std.ts';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext.std.ts';

import type { PreferencesSelectChatsDialogProps as Props } from './PreferencesSelectChatsDialog.dom.tsx';

const { i18n } = window.SignalContext;
const useTheme = () => useContext(StorybookThemeContext);

const conversations = Array.from({ length: 25 })
  .fill(undefined)
  .map((_value, index) =>
    index > 15 ? getDefaultGroup() : getDefaultConversation()
  );

export default {
  title: 'Components/Preferences/PreferencesSelectChatsDialog',
  component: PreferencesSelectChatsDialog,
  args: {
    conversations,
    conversationSelector: () => getDefaultConversation(),
    preferredBadgeSelector: () => undefined,
    i18n,
    onClose: action('close'),
    showChatTypes: false,
    title: 'Title for Stories',
    initialSelection: {
      selectedRecipientIds: [],
      selectAllIndividualChats: false,
      selectAllGroupChats: false,
    },
  },
} satisfies Meta<Props>;

const Template: StoryFn<Props> = args => {
  const theme = useTheme();

  return <PreferencesSelectChatsDialog {...args} theme={theme} />;
};

export const Default = Template.bind({});
Default.args = {
  title: 'Default',
};

export const ShowingChatTypes = Template.bind({});
ShowingChatTypes.args = {
  showChatTypes: true,
};

export const WithInitialSelectionRecipientIds = Template.bind({});
WithInitialSelectionRecipientIds.args = {
  initialSelection: {
    selectedRecipientIds: conversations
      .slice(0, 5)
      .map(conversation => conversation.id),
    selectAllIndividualChats: false,
    selectAllGroupChats: false,
  },
};

export const WithInitialSelectionAllIndividual = Template.bind({});
WithInitialSelectionAllIndividual.args = {
  showChatTypes: true,
  initialSelection: {
    selectedRecipientIds: [],
    selectAllIndividualChats: true,
    selectAllGroupChats: false,
  },
};

export const WithInitialSelectionAllGroup = Template.bind({});
WithInitialSelectionAllGroup.args = {
  showChatTypes: true,
  initialSelection: {
    selectedRecipientIds: [],
    selectAllIndividualChats: false,
    selectAllGroupChats: true,
  },
};
