// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './AvatarModalButtons';
import { AvatarModalButtons } from './AvatarModalButtons';
import { setupI18n } from '../util/setupI18n';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  hasChanges: Boolean(overrideProps.hasChanges),
  i18n,
  onCancel: action('onCancel'),
  onSave: action('onSave'),
});

const story = storiesOf('Components/AvatarModalButtons', module);

story.add('Has changes', () => (
  <AvatarModalButtons
    {...createProps({
      hasChanges: true,
    })}
  />
));

story.add('No changes', () => <AvatarModalButtons {...createProps()} />);
