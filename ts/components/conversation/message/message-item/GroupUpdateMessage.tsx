import React from 'react';

import {
  PropsForGroupUpdate,
  PropsForGroupUpdateType,
} from '../../../../state/ducks/conversations';
import { NotificationBubble } from './notification-bubble/NotificationBubble';
import { ReadableMessage } from './ReadableMessage';
import { arrayContainsUsOnly } from '../../../../models/message';
import { useConversationsUsernameWithQuoteOrFullPubkey } from '../../../../hooks/useParamSelector';

// This component is used to display group updates in the conversation view.

const ChangeItemJoined = (added: Array<string>): string => {
  if (!added.length) {
    throw new Error('Group update add is missing contacts');
  }
  const names = useConversationsUsernameWithQuoteOrFullPubkey(added);
  const joinKey = added.length > 1 ? 'multipleJoinedTheGroup' : 'joinedTheGroup';
  return window.i18n(joinKey, [names.join(', ')]);
};

const ChangeItemKicked = (kicked: Array<string>): string => {
  if (!kicked.length) {
    throw new Error('Group update kicked is missing contacts');
  }
  const names = useConversationsUsernameWithQuoteOrFullPubkey(kicked);

  if (arrayContainsUsOnly(kicked)) {
    return window.i18n('youGotKickedFromGroup');
  }

  const kickedKey = kicked.length > 1 ? 'multipleKickedFromTheGroup' : 'kickedFromTheGroup';
  return window.i18n(kickedKey, [names.join(', ')]);
};

const ChangeItemLeft = (left: Array<string>): string => {
  if (!left.length) {
    throw new Error('Group update remove is missing contacts');
  }

  const names = useConversationsUsernameWithQuoteOrFullPubkey(left);

  if (arrayContainsUsOnly(left)) {
    return window.i18n('youLeftTheGroup');
  }

  const leftKey = left.length > 1 ? 'multipleLeftTheGroup' : 'leftTheGroup';
  return window.i18n(leftKey, [names.join(', ')]);
};

// tslint:disable-next-line: cyclomatic-complexity
const ChangeItem = (change: PropsForGroupUpdateType): string => {
  switch (change.type) {
    case 'name':
      return window.i18n('titleIsNow', [change.newName || '']);
    case 'add':
      return ChangeItemJoined(change.added);

    case 'left':
      return ChangeItemLeft(change.left);

    case 'kicked':
      return ChangeItemKicked(change.kicked);

    case 'general':
      return window.i18n('updatedTheGroup');
    default:
      throw new Error('Missing case error');
  }
};

export const GroupUpdateMessage = (props: PropsForGroupUpdate) => {
  const { change, messageId, receivedAt, isUnread } = props;

  return (
    <ReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={isUnread}
      key={`readable-message-${messageId}`}
    >
      <NotificationBubble notificationText={ChangeItem(change)} iconType="users" />
    </ReadableMessage>
  );
};
