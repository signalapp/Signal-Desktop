// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { DropZone } from './DropZone';

storiesOf('Sticker Creator/elements', module).add('DropZone', () => {
  return <DropZone label="This is the label" onDrop={action('onDrop')} />;
});
