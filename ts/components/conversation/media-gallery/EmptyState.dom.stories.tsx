// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './EmptyState.dom.js';
import { EmptyState } from './EmptyState.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/MediaGallery/EmptyState',
  argTypes: {
    tab: {
      control: { type: 'select' },
      options: ['media', 'audio', 'links', 'documents'],
    },
  },
  args: {
    i18n,
    tab: 'media',
  },
} satisfies Meta<Props>;

export function Default(args: Props): JSX.Element {
  return <EmptyState {...args} />;
}

export function Media(args: Props): JSX.Element {
  return <EmptyState {...args} tab="media" />;
}

export function Audio(args: Props): JSX.Element {
  return <EmptyState {...args} tab="audio" />;
}

export function Links(args: Props): JSX.Element {
  return <EmptyState {...args} tab="links" />;
}

export function Documents(args: Props): JSX.Element {
  return <EmptyState {...args} tab="documents" />;
}
