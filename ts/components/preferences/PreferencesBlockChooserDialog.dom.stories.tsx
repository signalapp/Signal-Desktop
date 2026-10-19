// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useContext } from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta, StoryFn } from '@storybook/react';

import { PreferencesBlockChooserDialog } from './PreferencesBlockChooserDialog.dom.tsx';
import {
  getDefaultConversation,
  getDefaultGroup,
} from '../../test-helpers/getDefaultConversation.std.ts';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext.std.ts';

import type { Props } from './PreferencesBlockChooserDialog.dom.tsx';

const { i18n } = window.SignalContext;
const useTheme = () => useContext(StorybookThemeContext);

const conversations = Array.from({ length: 25 })
  .fill(undefined)
  .map((_value, index) =>
    index > 15 ? getDefaultGroup() : getDefaultConversation()
  );

export default {
  title: 'Components/Preferences/PreferencesBlockChooserDialog',
  component: PreferencesBlockChooserDialog,
  args: {
    conversations,
    i18n,
    onBlock: action('onBlock'),
    onClose: action('close'),
    open: true,
    preferredBadgeSelector: () => undefined,
    title: 'Title for Stories',
  },
} satisfies Meta<Props>;

const Template: StoryFn<Props> = args => {
  const theme = useTheme();

  return <PreferencesBlockChooserDialog {...args} theme={theme} />;
};

export const Default = Template.bind({});
Default.args = {
  title: 'Default',
};
