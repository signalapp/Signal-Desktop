// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { Props } from './ShortcutGuide';
import { ShortcutGuide } from './ShortcutGuide';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/ShortcutGuide',
} satisfies Meta<Props>;

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  close: action('close'),
  hasInstalledStickers: overrideProps.hasInstalledStickers === true || false,
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

export function HasStickers(): JSX.Element {
  const props = createProps({ hasInstalledStickers: true });
  return <ShortcutGuide {...props} />;
}
