// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './CustomColorEditor.dom.js';
import { CustomColorEditor } from './CustomColorEditor.dom.js';

export default {
  title: 'Components/CustomColorEditor',
} satisfies Meta<PropsType>;

const { i18n } = window.SignalContext;

const createProps = (): PropsType => ({
  i18n,
  onClose: action('onClose'),
  onSave: action('onSave'),
});

export function Default(): JSX.Element {
  return <CustomColorEditor {...createProps()} />;
}
