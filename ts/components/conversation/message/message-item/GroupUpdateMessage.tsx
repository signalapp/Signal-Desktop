import { useConversationsUsernameWithQuoteOrFullPubkey } from '../../../../hooks/useParamSelector';
import { arrayContainsUsOnly } from '../../../../models/message';
import {
  PropsForGroupUpdate,
  PropsForGroupUpdateType,
} from '../../../../state/ducks/conversations';
import { assertUnreachable } from '../../../../types/sqlSharedTypes';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';
import { NotificationBubble } from './notification-bubble/NotificationBubble';

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

const ChangeItem = (change: PropsForGroupUpdateType): string => {
  const { type } = change;
  switch (type) {
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
      assertUnreachable(type, `ChangeItem: Missing case error "${type}"`);
      return '';
  }
};

export const GroupUpdateMessage = (props: PropsForGroupUpdate) => {
  const { change, messageId } = props;

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      key={`readable-message-${messageId}`}
      dataTestId="group-update-message"
      isControlMessage={true}
    >
      <NotificationBubble notificationText={ChangeItem(change)} iconType="users" />
    </ExpirableReadableMessage>
  );
};
