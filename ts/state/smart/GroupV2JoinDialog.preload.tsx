// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { memo, useCallback, type ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { GroupV2JoinDialog } from '../../components/GroupV2JoinDialog.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import { getIntl } from '../selectors/user.std.ts';
import { getPreJoinConversation } from '../selectors/conversations.dom.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';

export const SmartGroupV2JoinDialog = memo(
  function SmartGroupV2JoinDialog(): ReactNode {
    const i18n = useSelector(getIntl);
    const preJoinConversation = useSelector(getPreJoinConversation);
    const { completeJoinViaLink, cancelJoinViaLink } =
      useConversationsActions();

    const handleJoin = useCallback(() => {
      drop(completeJoinViaLink());
    }, [completeJoinViaLink]);

    const handleClose = useCallback(() => {
      drop(cancelJoinViaLink());
    }, [cancelJoinViaLink]);

    if (preJoinConversation == null) {
      return null;
    }

    return (
      <GroupV2JoinDialog
        i18n={i18n}
        title={preJoinConversation.title}
        avatarUrl={preJoinConversation.avatar?.url ?? null}
        avatarLoading={preJoinConversation.avatar?.loading ?? false}
        memberCount={preJoinConversation.memberCount}
        groupDescription={preJoinConversation.groupDescription ?? null}
        approvalRequired={preJoinConversation.approvalRequired}
        onJoin={handleJoin}
        onClose={handleClose}
      />
    );
  }
);
