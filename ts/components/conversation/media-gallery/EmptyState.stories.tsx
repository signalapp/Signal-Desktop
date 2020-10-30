// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text, withKnobs } from '@storybook/addon-knobs';
import { EmptyState } from './EmptyState';

const story = storiesOf(
  'Components/Conversation/MediaGallery/EmptyState',
  module
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
story.addDecorator((withKnobs as any)({ escapeHTML: false }));

story.add('Default', () => {
  return <EmptyState label={text('label', 'placeholder text')} />;
});
