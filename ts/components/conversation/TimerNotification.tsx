import React from 'react';

import { missingCaseError } from '../../util/missingCaseError';
import { PropsForExpirationTimer } from '../../state/ducks/conversations';

import { ExpirableReadableMessage } from './message/message-item/ExpirableReadableMessage';
import { SessionIcon } from '../icon';
import { SpacerSM, Text } from '../basic/Text';
import { Flex } from '../basic/Flex';
import styled from 'styled-components';

const StyledTimerNotification = styled(Flex)`
  text-align: center;
`;
export const TimerNotification = (props: PropsForExpirationTimer) => {
  const {
    messageId,
    receivedAt,
    direction,
    isUnread,
    pubkey,
    profileName,
    expirationType,
    expirationLength,
    expirationTimestamp,
    timespan,
    type,
    disabled,
  } = props;

  const contact = profileName || pubkey;
  // TODO legacy messages support will be removed in a future release
  const mode =
    expirationType === 'legacy'
      ? null
      : expirationType === 'deleteAfterRead'
      ? window.i18n('timerModeRead')
      : window.i18n('timerModeSent');

  let textToRender: string | undefined;
  switch (type) {
    case 'fromOther':
      textToRender = disabled
        ? window.i18n('disabledDisappearingMessages', [contact, timespan])
        : mode
        ? window.i18n('theyChangedTheTimer', [contact, timespan, mode])
        : window.i18n('theyChangedTheTimerLegacy', [contact, timespan]);
      break;
    case 'fromMe':
    case 'fromSync':
      textToRender = disabled
        ? window.i18n('youDisabledDisappearingMessages')
        : mode
        ? window.i18n('youChangedTheTimer', [timespan, mode])
        : window.i18n('youChangedTheTimerLegacy', [timespan]);
      break;
    default:
      throw missingCaseError(type);
  }

  if (!textToRender || textToRender.length === 0) {
    throw new Error('textToRender invalid key used TimerNotification');
  }

  return (
    <ExpirableReadableMessage
      convoId={props.convoId}
      messageId={messageId}
      direction={direction}
      receivedAt={receivedAt}
      isUnread={isUnread}
      expirationLength={expirationLength}
      expirationTimestamp={expirationTimestamp}
      isExpired={props.isExpired}
      key={`readable-message-${messageId}`}
    >
      <StyledTimerNotification
        container={true}
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        width="90%"
        maxWidth="700px"
        margin="10px auto"
        padding="5px 10px"
      >
        <SessionIcon iconType="stopwatch" iconColor="inherit" iconSize="medium" />
        <SpacerSM />
        <Text text={textToRender} />
      </StyledTimerNotification>
    </ExpirableReadableMessage>
  );
};
