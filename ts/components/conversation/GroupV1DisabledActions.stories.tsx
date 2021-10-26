// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import type { PropsType as GroupV1DisabledActionsPropsType } from './GroupV1DisabledActions';
import { GroupV1DisabledActions } from './GroupV1DisabledActions';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (): GroupV1DisabledActionsPropsType => ({
  i18n,
  onStartGroupMigration: action('onStartGroupMigration'),
});

const stories = storiesOf(
  'Components/Conversation/GroupV1DisabledActions',
  module
);

stories.add('Default', () => {
  return <GroupV1DisabledActions {...createProps()} />;
});
