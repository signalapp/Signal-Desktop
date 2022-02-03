import classNames from 'classnames';
import React, { useContext } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { useConversationPropsById, useIsPinned } from '../../../hooks/useParamSelector';
import { SectionType } from '../../../state/ducks/section';
import { isSearching } from '../../../state/selectors/search';
import { getFocusedSection } from '../../../state/selectors/section';
import { Timestamp } from '../../conversation/Timestamp';
import { SessionIcon } from '../../icon';
import { ContextConversationId } from './ConversationListItem';
import { UserItem } from './UserItem';

const NotificationSettingIcon = (props: { isMessagesSection: boolean }) => {
  const convoId = useContext(ContextConversationId);
  const convoSetting = useConversationPropsById(convoId)?.currentNotificationSetting;

  if (!props.isMessagesSection) {
    return null;
  }

  switch (convoSetting) {
    case 'all':
      return null;
    case 'disabled':
      return (
        <SessionIcon iconType="mute" iconColor={'var(--color-text-subtle)'} iconSize="small" />
      );
    case 'mentions_only':
      return (
        <SessionIcon iconType="bell" iconColor={'var(--color-text-subtle)'} iconSize="small" />
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

function useHeaderItemProps(conversationId: string) {
  const convoProps = useConversationPropsById(conversationId);
  if (!convoProps) {
    return null;
  }
  return {
    isPinned: !!convoProps.isPinned,
    mentionedUs: convoProps.mentionedUs || false,
    unreadCount: convoProps.unreadCount || 0,
    activeAt: convoProps.activeAt,
  };
}

const ListItemIcons = () => {
  const isMessagesSection = useSelector(getFocusedSection) === SectionType.Message;
  const conversationId = useContext(ContextConversationId);
  const isPinned = useIsPinned(conversationId);

  const pinIcon =
    isMessagesSection && isPinned ? (
      <SessionIcon iconType="pin" iconColor={'var(--color-text-subtle)'} iconSize="small" />
    ) : null;
  return (
    <StyledConversationListItemIconWrapper>
      {pinIcon}
      <NotificationSettingIcon isMessagesSection={isMessagesSection} />
    </StyledConversationListItemIconWrapper>
  );
};

export const ConversationListItemHeaderItem = () => {
  const conversationId = useContext(ContextConversationId);

  const isSearchingMode = useSelector(isSearching);

  const convoProps = useHeaderItemProps(conversationId);
  if (!convoProps) {
    return null;
  }
  const { unreadCount, mentionedUs, activeAt } = convoProps;

  let atSymbol = null;
  let unreadCountDiv = null;
  if (unreadCount > 0) {
    atSymbol = mentionedUs ? <p className="at-symbol">@</p> : null;
    unreadCountDiv = <p className="module-conversation-list-item__unread-count">{unreadCount}</p>;
  }

  return (
    <div className="module-conversation-list-item__header">
      <div
        className={classNames(
          'module-conversation-list-item__header__name',
          unreadCount > 0 ? 'module-conversation-list-item__header__name--with-unread' : null
        )}
      >
        <UserItem />
      </div>
      <ListItemIcons />

      {unreadCountDiv}
      {atSymbol}

      {!isSearchingMode && (
        <div
          className={classNames(
            'module-conversation-list-item__header__date',
            unreadCount > 0 ? 'module-conversation-list-item__header__date--has-unread' : null
          )}
        >
          <Timestamp timestamp={activeAt} isConversationListItem={true} momentFromNow={true} />
        </div>
      )}
    </div>
  );
};
