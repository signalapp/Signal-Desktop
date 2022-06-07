// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import { DropZone } from './DropZone';

export default {
  title: 'Sticker Creator/elements',
};

export const _DropZone = (): JSX.Element => {
  return <DropZone label="This is the label" onDrop={action('onDrop')} />;
};

_DropZone.story = {
  name: 'DropZone',
};
