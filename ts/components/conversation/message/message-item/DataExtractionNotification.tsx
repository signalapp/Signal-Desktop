import { PropsForDataExtractionNotification } from '../../../../models/messageType';
import { SignalService } from '../../../../protobuf';
import { ExpirableReadableMessage } from './ExpirableReadableMessage';
import { NotificationBubble } from './notification-bubble/NotificationBubble';

export const DataExtractionNotification = (props: PropsForDataExtractionNotification) => {
  const { name, type, source, messageId } = props;

  let contentText: string;
  if (type === SignalService.DataExtractionNotification.Type.MEDIA_SAVED) {
    contentText = window.i18n('savedTheFile', [name || source]);
  } else {
    contentText = window.i18n('tookAScreenshot', [name || source]);
  }

  return (
    <ExpirableReadableMessage
      messageId={messageId}
      dataTestId="data-extraction-notification"
      key={`readable-message-${messageId}`}
      isControlMessage={true}
    >
      <NotificationBubble notificationText={contentText} iconType="save" />
    </ExpirableReadableMessage>
  );
};
