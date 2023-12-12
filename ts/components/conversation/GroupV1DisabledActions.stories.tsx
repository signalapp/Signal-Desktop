// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType as GroupV1DisabledActionsPropsType } from './GroupV1DisabledActions';
import { GroupV1DisabledActions } from './GroupV1DisabledActions';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (): GroupV1DisabledActionsPropsType => ({
  conversationId: '123',
  i18n,
  showGV2MigrationDialog: action('showGV2MigrationDialog'),
});

export default {
  title: 'Components/Conversation/GroupV1DisabledActions',
} satisfies Meta<GroupV1DisabledActionsPropsType>;

export function Default(): JSX.Element {
  return <GroupV1DisabledActions {...createProps()} />;
}
