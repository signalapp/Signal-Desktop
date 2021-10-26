// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';
import { boolean, select } from '@storybook/addon-knobs';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { Props } from './ShortcutGuide';
import { ShortcutGuide } from './ShortcutGuide';

const i18n = setupI18n('en', enMessages);
const story = storiesOf('Components/ShortcutGuide', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  close: action('close'),
  hasInstalledStickers: boolean(
    'hasInstalledStickers',
    overrideProps.hasInstalledStickers || false
  ),
  platform: select(
    'platform',
    {
      macOS: 'darwin',
      other: 'other',
    },
    overrideProps.platform || 'other'
  ),
});

story.add('Default', () => {
  const props = createProps({});
  return <ShortcutGuide {...props} />;
});

story.add('Mac', () => {
  const props = createProps({ platform: 'darwin' });
  return <ShortcutGuide {...props} />;
});

story.add('Has Stickers', () => {
  const props = createProps({ hasInstalledStickers: true });
  return <ShortcutGuide {...props} />;
});
