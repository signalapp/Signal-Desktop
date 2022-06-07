// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';
import { select } from '@storybook/addon-knobs';

import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './ChatColorPicker';
import { ChatColorPicker } from './ChatColorPicker';
import { ConversationColors } from '../types/Colors';
import { setupI18n } from '../util/setupI18n';

export default {
  title: 'Components/ChatColorPicker',
};

const i18n = setupI18n('en', enMessages);

const SAMPLE_CUSTOM_COLOR = {
  deg: 90,
  end: { hue: 197, saturation: 100 },
  start: { hue: 315, saturation: 78 },
};

const createProps = (): PropsType => ({
  addCustomColor: action('addCustomColor'),
  colorSelected: action('colorSelected'),
  editCustomColor: action('editCustomColor'),
  getConversationsWithCustomColor: (_: string) => Promise.resolve([]),
  i18n,
  removeCustomColor: action('removeCustomColor'),
  removeCustomColorOnConversations: action('removeCustomColorOnConversations'),
  resetAllChatColors: action('resetAllChatColors'),
  resetDefaultChatColor: action('resetDefaultChatColor'),
  selectedColor: select('selectedColor', ConversationColors, 'basil' as const),
  selectedCustomColor: {},
  setGlobalDefaultConversationColor: action(
    'setGlobalDefaultConversationColor'
  ),
});

export const Default = (): JSX.Element => (
  <ChatColorPicker {...createProps()} />
);

const CUSTOM_COLORS = {
  abc: {
    start: { hue: 32, saturation: 100 },
  },
  def: {
    deg: 90,
    start: { hue: 180, saturation: 100 },
    end: { hue: 0, saturation: 100 },
  },
  ghi: SAMPLE_CUSTOM_COLOR,
  jkl: {
    deg: 90,
    start: { hue: 161, saturation: 52 },
    end: { hue: 153, saturation: 89 },
  },
};

export const CustomColors = (): JSX.Element => (
  <ChatColorPicker
    {...createProps()}
    customColors={CUSTOM_COLORS}
    selectedColor="custom"
    selectedCustomColor={{
      id: 'ghi',
      value: SAMPLE_CUSTOM_COLOR,
    }}
  />
);
