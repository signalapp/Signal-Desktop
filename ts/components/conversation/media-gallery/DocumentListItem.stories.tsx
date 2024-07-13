// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './DocumentListItem';
import { DocumentListItem } from './DocumentListItem';

export default {
  title: 'Components/Conversation/MediaGallery/DocumentListItem',
  argTypes: {
    timestamp: { control: { type: 'date' } },
    fileName: { control: { type: 'text' } },
    fileSize: { control: { type: 'number' } },
    shouldShowSeparator: { control: { type: 'boolean' } },
  },
  args: {
    timestamp: Date.now(),
    fileName: 'meow.jpg',
    fileSize: 1024 * 1000 * 2,
    shouldShowSeparator: false,
    onClick: action('onClick'),
  },
} satisfies Meta<Props>;

export function Single(args: Props): JSX.Element {
  return <DocumentListItem {...args} />;
}

export function Multiple(): JSX.Element {
  const items = [
    {
      fileName: 'meow.jpg',
      fileSize: 1024 * 1000 * 2,
      timestamp: Date.now(),
    },
    {
      fileName: 'rickroll.mp4',
      fileSize: 1024 * 1000 * 8,
      timestamp: Date.now() - 24 * 60 * 60 * 1000,
    },
    {
      fileName: 'kitten.gif',
      fileSize: 1024 * 1000 * 1.2,
      timestamp: Date.now() - 14 * 24 * 60 * 60 * 1000,
      shouldShowSeparator: false,
    },
  ];

  return (
    <>
      {items.map(item => (
        <DocumentListItem
          key={item.fileName}
          onClick={action('onClick')}
          {...item}
        />
      ))}
    </>
  );
}
