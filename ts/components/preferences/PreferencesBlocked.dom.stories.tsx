// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useContext } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta, StoryFn } from '@storybook/react';

import { PreferencesBlocked } from './PreferencesBlocked.dom.tsx';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../../test-helpers/getDefaultConversation.std.ts';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext.std.ts';
import { DAY } from '../../util/durations/constants.std.ts';

import type { Props } from './PreferencesBlocked.dom.tsx';
import { ThemeType } from '../../types/Util.std.ts';

const { i18n } = window.SignalContext;
const useTheme = () => useContext(StorybookThemeContext);

export default {
  title: 'Components/Preferences/PreferencesBlocked',
  component: PreferencesBlocked,
  args: {
    blockedContacts: [],
    blockedGroups: [],
    conversationsNotBlocked: [],
    getPreferredBadge: () => undefined,
    goBack: action('goBack'),
    i18n,
    onBlock: action('onBlock'),
    onUnblock: action('onUnblock'),
    theme: ThemeType.light,
  },
} satisfies Meta<Props>;

const Template: StoryFn<Props> = args => {
  const theme = useTheme();

  return <PreferencesBlocked {...args} theme={theme} />;
};

export const Default = Template.bind({});
Default.args = {
  blockedContacts: Array.from({ length: 3 })
    .fill(undefined)
    .map(() => ({
      conversation: getDefaultConversation(),
      blockedAt: Date.now() - DAY,
    })),
  blockedGroups: Array.from({ length: 3 })
    .fill(undefined)
    .map(() => ({
      conversation: getDefaultGroup(),
      blockedAt: Date.now() - DAY,
    })),
  conversationsNotBlocked: Array.from({ length: 10 })
    .fill(undefined)
    .map((_value, index) =>
      index > 5 ? getDefaultGroup() : getDefaultConversation()
    ),
};

export const NoBlocked = Template.bind({});

export const With1Contact = Template.bind({});
With1Contact.args = {
  blockedContacts: [
    { conversation: getDefaultConversation(), blockedAt: undefined },
  ],
};

export const With1Group = Template.bind({});
With1Group.args = {
  blockedGroups: [
    {
      conversation: getDefaultGroup(),
      blockedAt: undefined,
    },
  ],
};

export const With1BothWithBlockedAt = Template.bind({});
With1BothWithBlockedAt.args = {
  blockedContacts: [
    { conversation: getDefaultConversation(), blockedAt: Date.now() },
  ],
  blockedGroups: [
    {
      conversation: getDefaultGroup(),
      blockedAt: Date.now() - DAY,
    },
  ],
};

export const WithManyContacts = Template.bind({});
WithManyContacts.args = {
  blockedContacts: Array.from({ length: 55 })
    .fill(undefined)
    .map(() => ({
      conversation: getDefaultConversation(),
      blockedAt: undefined,
    })),
};

export const WithManyGroups = Template.bind({});
WithManyGroups.args = {
  blockedGroups: Array.from({ length: 55 })
    .fill(undefined)
    .map(() => ({
      conversation: getDefaultGroup(),
      blockedAt: undefined,
    })),
};

export const WithManyBoth = Template.bind({});
WithManyBoth.args = {
  blockedContacts: Array.from({ length: 20 })
    .fill(undefined)
    .map(() => ({
      conversation: getDefaultConversation(),
      blockedAt: undefined,
    })),
  blockedGroups: Array.from({ length: 20 })
    .fill(undefined)
    .map(() => ({
      conversation: getDefaultGroup(),
      blockedAt: undefined,
    })),
};
