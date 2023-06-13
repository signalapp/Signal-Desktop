import React from 'react';
import { animation, Item, Menu, Submenu } from 'react-contexify';
import { useSelector } from 'react-redux';
import { setNotificationForConvoId } from '../../interactions/conversationInteractions';
import {
  ConversationNotificationSetting,
  ConversationNotificationSettingType,
} from '../../models/conversationAttributes';
import { isSearching } from '../../state/selectors/search';
import {
  useSelectedConversationKey,
  useSelectedIsActive,
  useSelectedIsBlocked,
  useSelectedIsKickedFromGroup,
  useSelectedIsLeft,
  useSelectedIsPrivate,
  useSelectedIsPrivateFriend,
  useSelectedNotificationSetting,
} from '../../state/selectors/selectedConversation';
import { LocalizerKeys } from '../../types/LocalizerKeys';
import { ContextConversationProvider } from '../leftpane/conversation-list-item/ConvoIdContext';
import { SessionContextMenuContainer } from '../SessionContextMenuContainer';
import {
  AddModeratorsMenuItem,
  BanMenuItem,
  BlockMenuItem,
  ChangeNicknameMenuItem,
  ClearNicknameMenuItem,
  CopyMenuItem,
  DeleteGroupOrCommunityMenuItem,
  DeleteMessagesMenuItem,
  DeletePrivateContactMenuItem,
  DeletePrivateConversationMenuItem,
  InviteContactMenuItem,
  LeaveGroupMenuItem,
  MarkAllReadMenuItem,
  RemoveModeratorsMenuItem,
  ShowUserDetailsMenuItem,
  UnbanMenuItem,
  UpdateGroupNameMenuItem,
} from './Menu';

export type PropsConversationHeaderMenu = {
  triggerId: string;
};

export const ConversationHeaderMenu = (props: PropsConversationHeaderMenu) => {
  const { triggerId } = props;

  const convoId = useSelectedConversationKey();
  const isPrivateFriend = useSelectedIsPrivateFriend();
  const isPrivate = useSelectedIsPrivate();
  const isSearchingMode = useSelector(isSearching);

  if (!convoId) {
    throw new Error('convoId must be set for a header to be visible!');
  }
  if (isSearchingMode) {
    return null;
  }

  // we do not want the triple dots menu at all if this is not a friend at all
  if (isPrivate && !isPrivateFriend) {
    return null;
  }

  return (
    <ContextConversationProvider value={convoId}>
      <SessionContextMenuContainer>
        <Menu id={triggerId} animation={animation.fade}>
          <NotificationForConvoMenuItem />
          <BlockMenuItem />
          <CopyMenuItem />
          <MarkAllReadMenuItem />
          <ChangeNicknameMenuItem />
          <ClearNicknameMenuItem />
          <AddModeratorsMenuItem />
          <RemoveModeratorsMenuItem />
          <BanMenuItem />
          <UnbanMenuItem />
          <UpdateGroupNameMenuItem />
          <LeaveGroupMenuItem />
          <InviteContactMenuItem />
          <DeleteMessagesMenuItem />
          <DeletePrivateConversationMenuItem />
          <DeletePrivateContactMenuItem />
          <DeleteGroupOrCommunityMenuItem />
          <ShowUserDetailsMenuItem />
        </Menu>
      </SessionContextMenuContainer>
    </ContextConversationProvider>
  );
};

/**
 * Only accessible through the triple dots menu on the conversation header. Not on the Conversation list item, because there is too much to check for before showing it
 */
const NotificationForConvoMenuItem = (): JSX.Element | null => {
  const selectedConvoId = useSelectedConversationKey();

  const currentNotificationSetting = useSelectedNotificationSetting();
  const isBlocked = useSelectedIsBlocked();
  const isActive = useSelectedIsActive();
  const isLeft = useSelectedIsLeft();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const isFriend = useSelectedIsPrivateFriend();
  const isPrivate = useSelectedIsPrivate();

  if (
    !selectedConvoId ||
    isLeft ||
    isKickedFromGroup ||
    isBlocked ||
    !isActive ||
    (isPrivate && !isFriend)
  ) {
    return null;
  }

  // const isRtlMode = isRtlBody();'

  // exclude mentions_only settings for private chats as this does not make much sense
  const notificationForConvoOptions = ConversationNotificationSetting.filter(n =>
    isPrivate ? n !== 'mentions_only' : true
  ).map((n: ConversationNotificationSettingType) => {
    // do this separately so typescript's compiler likes it
    const keyToUse: LocalizerKeys =
      n === 'all' || !n
        ? 'notificationForConvo_all'
        : n === 'disabled'
        ? 'notificationForConvo_disabled'
        : 'notificationForConvo_mentions_only';
    return { value: n, name: window.i18n(keyToUse) };
  });

  return (
    // Remove the && false to make context menu work with RTL support
    <Submenu
      label={window.i18n('notificationForConvo') as any}
      // rtl={isRtlMode && false}
    >
      {(notificationForConvoOptions || []).map(item => {
        const disabled = item.value === currentNotificationSetting;

        return (
          <Item
            key={item.value}
            onClick={async () => {
              await setNotificationForConvoId(selectedConvoId, item.value);
            }}
            disabled={disabled}
          >
            {item.name}
          </Item>
        );
      })}
    </Submenu>
  );

  return null;
};
