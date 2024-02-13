import { PubKey } from '../../../../../session/types';

import {
  CallNotificationType,
  PropsForCallNotification,
} from '../../../../../state/ducks/conversations';
import {
  useSelectedConversationKey,
  useSelectedDisplayNameInProfile,
  useSelectedNickname,
} from '../../../../../state/selectors/selectedConversation';
import { LocalizerKeys } from '../../../../../types/LocalizerKeys';
import { SessionIconType } from '../../../../icon';
import { ExpirableReadableMessage } from '../ExpirableReadableMessage';
import { NotificationBubble } from './NotificationBubble';

type StyleType = Record<
  CallNotificationType,
  { notificationTextKey: LocalizerKeys; iconType: SessionIconType; iconColor: string }
>;

const style: StyleType = {
  'missed-call': {
    notificationTextKey: 'callMissed',
    iconType: 'callMissed',
    iconColor: 'var(--danger-color)',
  },
  'started-call': {
    notificationTextKey: 'startedACall',
    iconType: 'callOutgoing',
    iconColor: 'inherit',
  },
  'answered-a-call': {
    notificationTextKey: 'answeredACall',
    iconType: 'callIncoming',
    iconColor: 'inherit',
  },
};

export const CallNotification = (props: PropsForCallNotification) => {
  const { messageId, notificationType } = props;
  const selectedConvoId = useSelectedConversationKey();

  const displayNameInProfile = useSelectedDisplayNameInProfile();
  const nickname = useSelectedNickname();

  const displayName =
    nickname || displayNameInProfile || (selectedConvoId && PubKey.shorten(selectedConvoId));

  const styleItem = style[notificationType];
  const notificationText = window.i18n(styleItem.notificationTextKey, [
    displayName || window.i18n('unknown'),
  ]);
  if (!window.i18n(styleItem.notificationTextKey)) {
    throw new Error(`invalid i18n key ${styleItem.notificationTextKey}`);
  }
  const iconType = styleItem.iconType;
  const iconColor = styleItem.iconColor;

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      key={`readable-message-${messageId}`}
      dataTestId={`call-notification-${notificationType}`}
      isControlMessage={true}
    >
      <NotificationBubble
        notificationText={notificationText}
        iconType={iconType}
        iconColor={iconColor}
      />
    </ExpirableReadableMessage>
  );
};
