// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType as GroupV2PendingApprovalActionsPropsType } from './GroupV2PendingApprovalActions';
import { GroupV2PendingApprovalActions } from './GroupV2PendingApprovalActions';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (): GroupV2PendingApprovalActionsPropsType => ({
  cancelJoinRequest: action('cancelJoinRequest'),
  conversationId: 'some-random-id',
  i18n,
});

export default {
  title: 'Components/Conversation/GroupV2PendingApprovalActions',
} satisfies Meta<GroupV2PendingApprovalActionsPropsType>;

export function Default(): JSX.Element {
  return <GroupV2PendingApprovalActions {...createProps()} />;
}
