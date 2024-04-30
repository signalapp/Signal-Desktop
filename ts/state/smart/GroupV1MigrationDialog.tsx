// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { DataPropsType as GroupV1MigrationDialogPropsType } from '../../components/GroupV1MigrationDialog';
import { GroupV1MigrationDialog } from '../../components/GroupV1MigrationDialog';
import { useConversationsActions } from '../ducks/conversations';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl, getTheme } from '../selectors/user';
import * as log from '../../logging/log';
import { useGlobalModalActions } from '../ducks/globalModals';

export type PropsType = {
  readonly conversationId: string;
  readonly droppedMemberIds: Array<string>;
  readonly invitedMemberIds: Array<string>;
} & Omit<
  GroupV1MigrationDialogPropsType,
  'i18n' | 'droppedMembers' | 'invitedMembers' | 'theme' | 'getPreferredBadge'
>;

function isNonNullable<T>(value: T | null | undefined): value is T {
  return value != null;
}

export const SmartGroupV1MigrationDialog = memo(
  function SmartGroupV1MigrationDialog({
    conversationId,
    areWeInvited,
    hasMigrated,
    droppedMemberIds,
    invitedMemberIds,
  }: PropsType) {
    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);
    const getConversation = useSelector(getConversationSelector);
    const getPreferredBadge = useSelector(getPreferredBadgeSelector);

    const { initiateMigrationToGroupV2 } = useConversationsActions();
    const { closeGV2MigrationDialog } = useGlobalModalActions();

    const droppedMembers = useMemo(() => {
      const result = droppedMemberIds
        .map(getConversation)
        .filter(isNonNullable);
      if (result.length !== droppedMemberIds.length) {
        log.warn('smart/GroupV1MigrationDialog: droppedMembers length changed');
      }
      return result;
    }, [droppedMemberIds, getConversation]);

    const invitedMembers = useMemo(() => {
      const result = invitedMemberIds
        .map(getConversation)
        .filter(isNonNullable);
      if (result.length !== invitedMemberIds.length) {
        log.warn('smart/GroupV1MigrationDialog: invitedMembers length changed');
      }
      return result;
    }, [invitedMemberIds, getConversation]);

    const handleMigrate = useCallback(() => {
      initiateMigrationToGroupV2(conversationId);
    }, [initiateMigrationToGroupV2, conversationId]);

    return (
      <GroupV1MigrationDialog
        i18n={i18n}
        theme={theme}
        areWeInvited={areWeInvited}
        hasMigrated={hasMigrated}
        getPreferredBadge={getPreferredBadge}
        droppedMembers={droppedMembers}
        droppedMemberCount={droppedMembers.length}
        invitedMembers={invitedMembers}
        invitedMemberCount={invitedMembers.length}
        onMigrate={handleMigrate}
        onClose={closeGV2MigrationDialog}
      />
    );
  }
);
