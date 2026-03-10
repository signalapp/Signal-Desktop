// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { memo } from 'react';
import { useSelector } from 'react-redux';

import { GroupMemberLabelEditor } from '../../components/conversation/conversation-details/GroupMemberLabelEditor.dom.js';
import {
  getCachedConversationMemberColorsSelector,
  getConversationSelector,
} from '../selectors/conversations.dom.js';
import { getIntl, getTheme, getUser } from '../selectors/user.std.js';
import { useConversationsActions } from '../ducks/conversations.preload.js';
import { createLogger } from '../../logging/log.std.js';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.js';
import { isNotNil } from '../../util/isNotNil.std.js';
import { useNavActions } from '../ducks/nav.std.js';

const log = createLogger('SmartGroupMemberLabelEditor');

export type SmartGroupMemberLabelEditorProps = Readonly<{
  conversationId: string;
}>;

export const SmartGroupMemberLabelEditor = memo(
  function SmartGroupMemberLabelEditor({
    conversationId,
  }: SmartGroupMemberLabelEditorProps) {
    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);
    const user = useSelector(getUser);

    const conversationSelector = useSelector(getConversationSelector);
    const conversation = conversationSelector(conversationId);
    const me = conversationSelector(user.ourAci);

    const { updateGroupMemberLabel } = useConversationsActions();
    const { popPanelForConversation } = useNavActions();
    const getMemberColors = useSelector(
      getCachedConversationMemberColorsSelector
    );
    const memberColors = getMemberColors(conversationId);
    const ourColor = memberColors?.get(me.id);
    const getPreferredBadge = useSelector(getPreferredBadgeSelector);

    const { ourAci } = user;
    const ourMembership = conversation.memberships?.find(
      membership => membership?.aci === ourAci
    );
    if (!ourMembership) {
      log.warn('User was not found in group, leaving this pane!');
      popPanelForConversation();
      return null;
    }
    const { labelEmoji: existingLabelEmoji, labelString: existingLabelString } =
      ourMembership;

    const membersWithLabel = (conversation.memberships || [])
      .map(membership => {
        const { aci, isAdmin, labelEmoji, labelString } = membership;

        if (aci === me.serviceId) {
          return;
        }

        if (!labelString) {
          return;
        }

        const member = conversationSelector(aci);
        if (!member) {
          log.warn(
            'Group member was not found, excluding from members with labels'
          );
          return;
        }
        const contactNameColor = memberColors.get(member.id);
        if (!contactNameColor) {
          log.warn(
            'Color not found for group member, excluding from members with labels'
          );
          return;
        }

        return {
          contactNameColor,
          isAdmin,
          labelEmoji,
          labelString,
          member,
        };
      })
      .filter(isNotNil);

    return (
      <GroupMemberLabelEditor
        existingLabelEmoji={existingLabelEmoji}
        existingLabelString={existingLabelString}
        getPreferredBadge={getPreferredBadge}
        group={conversation}
        i18n={i18n}
        me={me}
        membersWithLabel={membersWithLabel}
        ourColor={ourColor}
        popPanelForConversation={popPanelForConversation}
        theme={theme}
        updateGroupMemberLabel={updateGroupMemberLabel}
      />
    );
  }
);
