// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import {
  GroupV1DisabledActions,
  PropsType as GroupV1DisabledActionsPropsType,
} from './GroupV1DisabledActions';
import { setup as setupI18n } from '../../../js/modules/i18n';
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
