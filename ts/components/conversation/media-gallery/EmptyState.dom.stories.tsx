// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { Props } from './EmptyState.dom.js';
import { EmptyState } from './EmptyState.dom.js';

export default {
  title: 'Components/Conversation/MediaGallery/EmptyState',
  argTypes: {
    label: { control: { type: 'text' } },
  },
  args: {
    label: 'placeholder text',
  },
} satisfies Meta<Props>;

export function Default(args: Props): JSX.Element {
  return <EmptyState {...args} />;
}
