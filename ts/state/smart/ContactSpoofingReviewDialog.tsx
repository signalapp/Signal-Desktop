// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { useSelector } from 'react-redux';
import type { StateType } from '../reducer';

import type { PropsType as DownstreamPropsType } from '../../components/conversation/ContactSpoofingReviewDialog';
import { ContactSpoofingReviewDialog } from '../../components/conversation/ContactSpoofingReviewDialog';

import type { ConversationType } from '../ducks/conversations';
import type { GetConversationByIdType } from '../selectors/conversations';
import { getConversationSelector } from '../selectors/conversations';
import { ContactSpoofingType } from '../../util/contactSpoofing';

export type PropsType = Omit<DownstreamPropsType, 'type'> &
  (
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

export const SmartContactSpoofingReviewDialog: React.ComponentType<
  PropsType
> = props => {
  const { type } = props;

  const getConversation = useSelector<StateType, GetConversationByIdType>(
    getConversationSelector
  );

  if (type === ContactSpoofingType.MultipleGroupMembersWithSameTitle) {
    return (
      <ContactSpoofingReviewDialog
        {...props}
        group={getConversation(props.groupConversationId)}
      />
    );
  }

  return <ContactSpoofingReviewDialog {...props} />;
};
