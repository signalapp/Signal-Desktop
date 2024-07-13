// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo } from 'react';
import { useSelector } from 'react-redux';
import type { PropsType as GroupV2JoinDialogPropsType } from '../../components/GroupV2JoinDialog';
import { GroupV2JoinDialog } from '../../components/GroupV2JoinDialog';
import { getIntl } from '../selectors/user';
import { getPreJoinConversation } from '../selectors/conversations';

export type SmartGroupV2JoinDialogProps = Pick<
  GroupV2JoinDialogPropsType,
  'join' | 'onClose'
>;

export const SmartGroupV2JoinDialog = memo(function SmartGroupV2JoinDialog({
  join,
  onClose,
}: SmartGroupV2JoinDialogProps) {
  const i18n = useSelector(getIntl);
  const preJoinConversation = useSelector(getPreJoinConversation);
  if (preJoinConversation == null) {
    throw new Error('smart/GroupV2JoinDialog: No pre-join conversation!');
  }
  const { memberCount, title, groupDescription, approvalRequired, avatar } =
    preJoinConversation;
  return (
    <GroupV2JoinDialog
      approvalRequired={approvalRequired}
      avatar={avatar}
      groupDescription={groupDescription}
      i18n={i18n}
      join={join}
      memberCount={memberCount}
      onClose={onClose}
      title={title}
    />
  );
});
