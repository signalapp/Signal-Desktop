// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';

import { ContactSpoofingReviewDialog } from '../../components/conversation/ContactSpoofingReviewDialog';

import type { ConversationType } from '../ducks/conversations';
import { useConversationsActions } from '../ducks/conversations';
import type { GetConversationByIdType } from '../selectors/conversations';
import { getConversationSelector } from '../selectors/conversations';
import { ContactSpoofingType } from '../../util/contactSpoofing';
import { useGlobalModalActions } from '../ducks/globalModals';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { getIntl, getTheme } from '../selectors/user';

export type PropsType =
  | {
      conversationId: string;
      onClose: () => void;
    } & (
      | {
          type: ContactSpoofingType.DirectConversationWithSameTitle;
          possiblyUnsafeConversation: ConversationType;
          safeConversation: ConversationType;
        }
      | {
          type: ContactSpoofingType.MultipleGroupMembersWithSameTitle;
          groupConversationId: string;
          collisionInfoByTitle: Record<
            string,
            Array<{
              oldName?: string;
              conversation: ConversationType;
            }>
          >;
        }
    );

export function SmartContactSpoofingReviewDialog(
  props: PropsType
): JSX.Element {
  const { type } = props;

  const getConversation = useSelector<StateType, GetConversationByIdType>(
    getConversationSelector
  );

  const {
    acceptConversation,
    blockAndReportSpam,
    blockConversation,
    deleteConversation,
    removeMember,
  } = useConversationsActions();
  const { showContactModal } = useGlobalModalActions();
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);

  const sharedProps = {
    acceptConversation,
    blockAndReportSpam,
    blockConversation,
    deleteConversation,
    getPreferredBadge,
    i18n,
    removeMember,
    showContactModal,
    theme,
  };

  if (type === ContactSpoofingType.MultipleGroupMembersWithSameTitle) {
    return (
      <ContactSpoofingReviewDialog
        {...props}
        {...sharedProps}
        group={getConversation(props.groupConversationId)}
      />
    );
  }

  return <ContactSpoofingReviewDialog {...props} {...sharedProps} />;
}
