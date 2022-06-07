// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { text } from '@storybook/addon-knobs';
import { EmptyState } from './EmptyState';

export default {
  title: 'Components/Conversation/MediaGallery/EmptyState',
};

export const Default = (): JSX.Element => {
  return <EmptyState label={text('label', 'placeholder text')} />;
};
