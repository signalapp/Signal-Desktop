// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { Props } from './ShortcutGuide.dom.js';
import { ShortcutGuide } from './ShortcutGuide.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/ShortcutGuide',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  close: action('close'),
  platform: overrideProps.platform || 'other',
});

export function Default(): JSX.Element {
  const props = createProps({});
  return <ShortcutGuide {...props} />;
}

export function Mac(): JSX.Element {
  const props = createProps({ platform: 'darwin' });
  return <ShortcutGuide {...props} />;
}
