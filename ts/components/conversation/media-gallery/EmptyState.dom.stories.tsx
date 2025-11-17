// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './EmptyState.dom.js';
import { EmptyState } from './EmptyState.dom.js';
import { TabViews } from './types/TabViews.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/MediaGallery/EmptyState',
  argTypes: {
    tab: {
      control: { type: 'select' },
      options: [TabViews.Media, TabViews.Documents, TabViews.Links],
    },
  },
  args: {
    i18n,
    tab: TabViews.Media,
  },
} satisfies Meta<Props>;

export function Default(args: Props): JSX.Element {
  return <EmptyState {...args} />;
}

export function Media(args: Props): JSX.Element {
  return <EmptyState {...args} tab={TabViews.Media} />;
}

export function Documents(args: Props): JSX.Element {
  return <EmptyState {...args} tab={TabViews.Documents} />;
}

export function Links(args: Props): JSX.Element {
  return <EmptyState {...args} tab={TabViews.Links} />;
}
