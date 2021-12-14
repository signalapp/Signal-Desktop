import React from 'react';

import {
  PropsForGroupUpdate,
  PropsForGroupUpdateAdd,
  PropsForGroupUpdateKicked,
  PropsForGroupUpdateRemove,
  PropsForGroupUpdateType,
} from '../../state/ducks/conversations';
import _ from 'underscore';
import { NotificationBubble } from './message/message-item/notification-bubble/NotificationBubble';
import { ReadableMessage } from './message/message-item/ReadableMessage';

// This component is used to display group updates in the conversation view.
// This is a not a "notification" as the name suggests, but a message inside the conversation

type TypeWithContacts =
  | PropsForGroupUpdateAdd
  | PropsForGroupUpdateKicked
  | PropsForGroupUpdateRemove;

function isTypeWithContact(change: PropsForGroupUpdateType): change is TypeWithContacts {
  return (change as TypeWithContacts).contacts !== undefined;
}

function getPeople(change: TypeWithContacts) {
  return change.contacts?.map(c => c.profileName || c.pubkey).join(', ');
}

// tslint:disable-next-line: cyclomatic-complexity
const ChangeItem = (change: PropsForGroupUpdateType): string => {
  const people = isTypeWithContact(change) ? getPeople(change) : undefined;

  switch (change.type) {
    case 'name':
      return window.i18n('titleIsNow', [change.newName || '']);
    case 'add':
      if (!change.contacts || !change.contacts.length || !people) {
        throw new Error('Group update add is missing contacts');
      }

      const joinKey = change.contacts.length > 1 ? 'multipleJoinedTheGroup' : 'joinedTheGroup';
      return window.i18n(joinKey, [people]);
    case 'remove':
      if (change.isMe) {
        return window.i18n('youLeftTheGroup');
      }

      if (!change.contacts || !change.contacts.length || !people) {
        throw new Error('Group update remove is missing contacts');
      }

      const leftKey = change.contacts.length > 1 ? 'multipleLeftTheGroup' : 'leftTheGroup';
      return window.i18n(leftKey, [people]);

    case 'kicked':
      if (change.isMe) {
        return window.i18n('youGotKickedFromGroup');
      }

      if (!change.contacts || !change.contacts.length || !people) {
        throw new Error('Group update kicked is missing contacts');
      }

      const kickedKey =
        change.contacts.length > 1 ? 'multipleKickedFromTheGroup' : 'kickedFromTheGroup';
      return window.i18n(kickedKey, [people]);

    case 'general':
      return window.i18n('updatedTheGroup');
    default:
      throw new Error('Missing case error');
  }
};

export const GroupNotification = (props: PropsForGroupUpdate) => {
  const { changes, messageId, receivedAt, isUnread } = props;

  const textChange = changes.map(ChangeItem)[0];

  return (
    <ReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={isUnread}
      key={`readable-message-${messageId}`}
    >
      <NotificationBubble notificationText={textChange} iconType="users" />
    </ReadableMessage>
  );
};
