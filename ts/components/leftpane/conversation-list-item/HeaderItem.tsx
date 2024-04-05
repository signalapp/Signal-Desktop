import classNames from 'classnames';
import React from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { useConvoIdFromContext } from '../../../contexts/ConvoIdContext';
import { Data } from '../../../data/data';
import {
  useActiveAt,
  useConversationPropsById,
  useHasUnread,
  useIsForcedUnreadWithoutUnreadMsg,
  useIsPinned,
  useMentionedUs,
  useUnreadCount,
} from '../../../hooks/useParamSelector';
import { Constants } from '../../../session';
import {
  openConversationToSpecificMessage,
  openConversationWithMessages,
} from '../../../state/ducks/conversations';
import { isSearching } from '../../../state/selectors/search';
import { getIsMessageSection } from '../../../state/selectors/section';
import { Timestamp } from '../../conversation/Timestamp';
import { SessionIcon } from '../../icon';
import { UserItem } from './UserItem';

const NotificationSettingIcon = () => {
  const isMessagesSection = useSelector(getIsMessageSection);
  const convoId = useConvoIdFromContext();
  const convoSetting = useConversationPropsById(convoId)?.currentNotificationSetting;

  if (!isMessagesSection) {
    return null;
  }

  switch (convoSetting) {
    case 'all':
      return null;
    case 'disabled':
      return (
        <SessionIcon
          iconType="mute"
          iconColor={'var(--conversation-tab-text-color)'}
          iconSize="small"
        />
      );
    case 'mentions_only':
      return (
        <SessionIcon
          iconType="bell"
          iconColor={'var(--conversation-tab-text-color)'}
          iconSize="small"
        />
      );
    default:
      return null;
  }
};

const StyledConversationListItemIconWrapper = styled.div`
  svg {
    margin: 0px 2px;
  }

  display: flex;
  flex-direction: row;
`;

const PinIcon = () => {
  const conversationId = useConvoIdFromContext();

  const isMessagesSection = useSelector(getIsMessageSection);
  const isPinned = useIsPinned(conversationId);

  return isMessagesSection && isPinned ? (
    <SessionIcon iconType="pin" iconColor={'var(--conversation-tab-text-color)'} iconSize="small" />
  ) : null;
};

const ListItemIcons = () => {
  return (
    <StyledConversationListItemIconWrapper>
      <PinIcon />
      <NotificationSettingIcon />
    </StyledConversationListItemIconWrapper>
  );
};

const MentionAtSymbol = styled.span`
  background: var(--unread-messages-alert-background-color);
  color: var(--unread-messages-alert-text-color);
  text-align: center;
  margin-top: 0px;
  margin-bottom: 0px;
  padding-inline-start: 3px;
  padding-inline-end: 3px;

  position: static;
  margin-inline-start: 5px;

  font-weight: 700;
  font-size: var(--font-size-xs);
  letter-spacing: 0.25px;

  height: 16px;
  min-width: 16px;
  border-radius: 8px;
  cursor: pointer;

  :hover {
    filter: grayscale(0.7);
  }
`;

/**
 * When clicking on the `@` symbol of a conversation, we open the conversation to the first unread message tagging us (with the @pubkey syntax)
 */
async function openConvoToLastMention(
  e: React.MouseEvent<HTMLSpanElement>,
  conversationId: string
) {
  e.stopPropagation();
  e.preventDefault();

  // mousedown is invoked sooner than onClick, but for both right and left click
  if (e.button === 0) {
    const oldestMessageUnreadWithMention =
      (await Data.getFirstUnreadMessageWithMention(conversationId)) || null;
    if (oldestMessageUnreadWithMention) {
      await openConversationToSpecificMessage({
        conversationKey: conversationId,
        messageIdToNavigateTo: oldestMessageUnreadWithMention,
        shouldHighlightMessage: true,
      });
    } else {
      window.log.info('cannot open to latest mention as no unread mention are found');
      await openConversationWithMessages({
        conversationKey: conversationId,
        messageId: null,
      });
    }
  }
}

const AtSymbol = ({ convoId }: { convoId: string }) => {
  const hasMentionedUs = useMentionedUs(convoId);
  const hasUnread = useHasUnread(convoId);

  return hasMentionedUs && hasUnread ? (
    <MentionAtSymbol
      title="Open to latest mention"
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onMouseDown={async e => openConvoToLastMention(e, convoId)}
    >
      @
    </MentionAtSymbol>
  ) : null;
};

const UnreadCount = ({ convoId }: { convoId: string }) => {
  const unreadMsgCount = useUnreadCount(convoId);
  const forcedUnread = useIsForcedUnreadWithoutUnreadMsg(convoId);

  const unreadWithOverflow =
    unreadMsgCount > Constants.CONVERSATION.MAX_CONVO_UNREAD_COUNT
      ? `${Constants.CONVERSATION.MAX_CONVO_UNREAD_COUNT}+`
      : unreadMsgCount || ' ';

  // TODO would be good to merge the style of this with SessionNotificationCount or SessionUnreadCount at some point.
  return unreadMsgCount > 0 || forcedUnread ? (
    <p className="module-conversation-list-item__unread-count">{unreadWithOverflow}</p>
  ) : null;
};

export const ConversationListItemHeaderItem = () => {
  const conversationId = useConvoIdFromContext();

  const isSearchingMode = useSelector(isSearching);

  const hasUnread = useHasUnread(conversationId);
  const activeAt = useActiveAt(conversationId);

  return (
    <div className="module-conversation-list-item__header">
      <div
        className={classNames(
          'module-conversation-list-item__header__name',
          hasUnread ? 'module-conversation-list-item__header__name--with-unread' : null
        )}
      >
        <UserItem />
      </div>
      <ListItemIcons />

      <UnreadCount convoId={conversationId} />
      <AtSymbol convoId={conversationId} />

      {!isSearchingMode && (
        <div
          className={classNames(
            'module-conversation-list-item__header__date',
            hasUnread ? 'module-conversation-list-item__header__date--has-unread' : null
          )}
        >
          <Timestamp timestamp={activeAt} isConversationListItem={true} momentFromNow={true} />
        </div>
      )}
    </div>
  );
};
