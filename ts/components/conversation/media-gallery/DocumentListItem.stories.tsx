// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { boolean, date, number, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { DocumentListItem } from './DocumentListItem';

export default {
  title: 'Components/Conversation/MediaGallery/DocumentListItem',
};

export const Single = (): JSX.Element => (
  <DocumentListItem
    timestamp={date('timestamp', new Date())}
    fileName={text('fileName', 'meow.jpg')}
    fileSize={number('fileSize', 1024 * 1000 * 2)}
    shouldShowSeparator={boolean('shouldShowSeparator', false)}
    onClick={action('onClick')}
  />
);

export const Multiple = (): JSX.Element => {
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
};
