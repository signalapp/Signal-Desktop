import React from 'react';
import styled from 'styled-components';

import { isEmpty } from 'lodash';
import moment from 'moment';
import useBoolean from 'react-use/lib/useBoolean';
import useInterval from 'react-use/lib/useInterval';
import { useMessageExpirationPropsById } from '../../../../hooks/useParamSelector';
import { DURATION } from '../../../../session/constants';
import { nativeEmojiData } from '../../../../util/emoji';
import { getRecentReactions } from '../../../../util/storage';
import { SpacerSM } from '../../../basic/Text';
import { SessionIcon, SessionIconButton } from '../../../icon';

type Props = {
  action: (...args: Array<any>) => void;
  additionalAction: (...args: Array<any>) => void;
  messageId: string;
};

const StyledMessageReactBar = styled.div`
  background-color: var(--emoji-reaction-bar-background-color);
  border-radius: 25px;
  box-shadow:
    0 2px 16px 0 rgba(0, 0, 0, 0.2),
    0 0px 20px 0 rgba(0, 0, 0, 0.19);

  padding: 4px 8px;
  white-space: nowrap;
  width: 302px;

  display: flex;
  align-items: center;

  .session-icon-button {
    margin: 0 4px;
    &:hover svg {
      background-color: var(--chat-buttons-background-hover-color);
    }
  }
`;

const ReactButton = styled.span`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 40px;
  height: 40px;

  border-radius: 300px;
  cursor: pointer;
  font-size: 24px;

  :hover {
    background-color: var(--chat-buttons-background-hover-color);
  }
`;

const StyledContainer = styled.div<{ expirationTimestamp: number | null }>`
  position: absolute;
  top: ${props => (props.expirationTimestamp ? '-106px' : '-56px')};
  display: flex;
  flex-direction: column;
  min-width: 0;
  align-items: flex-start;
  left: -1px;
`;

const StyledExpiresIn = styled.div`
  border-radius: 8px;
  padding: 10px;
  white-space: nowrap;
  color: var(--text-primary-color);
  size: var(--font-size-sm);
  background-color: var(--context-menu-background-color);
  box-shadow: 0px 0px 9px 0px var(--context-menu-shadow-color);
  margin-top: 7px;
  display: flex;
  align-items: center;
  min-width: 0;
`;

function useIsRenderedExpiresInItem(messageId: string) {
  const expiryDetails = useMessageExpirationPropsById(messageId);

  if (
    !expiryDetails ||
    isEmpty(expiryDetails) ||
    !expiryDetails.expirationDurationMs ||
    expiryDetails.isExpired ||
    !expiryDetails.expirationTimestamp
  ) {
    return null;
  }

  return expiryDetails.expirationTimestamp;
}

function formatTimeLeft({ timeLeftMs }: { timeLeftMs: number }) {
  const timeLeft = moment(timeLeftMs).utc();

  if (timeLeftMs <= 0) {
    return `0s`;
  }

  if (timeLeft.isBefore(moment.utc(0).add(1, 'minute'))) {
    return window.i18n('messageWillDisappear', [`${timeLeft.seconds()}s`]);
  }

  if (timeLeft.isBefore(moment.utc(0).add(1, 'hour'))) {
    const extraUnit = timeLeft.seconds() ? ` ${timeLeft.seconds()}s` : '';
    return window.i18n('messageWillDisappear', [`${timeLeft.minutes()}m${extraUnit}`]);
  }

  if (timeLeft.isBefore(moment.utc(0).add(1, 'day'))) {
    const extraUnit = timeLeft.minutes() ? ` ${timeLeft.minutes()}m` : '';
    return window.i18n('messageWillDisappear', [`${timeLeft.hours()}h${extraUnit}`]);
  }

  if (timeLeft.isBefore(moment.utc(0).add(7, 'day'))) {
    const extraUnit = timeLeft.hours() ? ` ${timeLeft.hours()}h` : '';
    return window.i18n('messageWillDisappear', [`${timeLeft.dayOfYear() - 1}d${extraUnit}`]);
  }

  if (timeLeft.isBefore(moment.utc(0).add(31, 'day'))) {
    const days = timeLeft.dayOfYear() - 1;
    const weeks = Math.floor(days / 7);
    const daysLeft = days % 7;
    const extraUnit = daysLeft ? ` ${daysLeft}d` : '';
    return window.i18n('messageWillDisappear', [`${weeks}w${extraUnit}`]);
  }

  return '...';
}

const ExpiresInItem = ({ expirationTimestamp }: { expirationTimestamp?: number | null }) => {
  // this boolean is just used to forceRefresh the state when we get to display seconds in the contextmenu
  const [refresh, setRefresh] = useBoolean(false);
  const timeLeftMs = (expirationTimestamp || 0) - Date.now();

  useInterval(
    () => {
      setRefresh(!refresh);
    },
    // We want to force refresh this component a lot more if the message has less than 1h before disappearing,
    // because when that's the case we also display the seconds left (i.e. 59min 23s) and we want that 23s to be dynamic.
    // Also, we use a refresh interval of 500 rather than 1s so that the counter is a bit smoother
    timeLeftMs > 0 && timeLeftMs <= 1 * DURATION.HOURS ? 500 : null
  );
  if (!expirationTimestamp || timeLeftMs < 0) {
    return null;
  }

  return (
    <StyledExpiresIn>
      <SessionIcon iconSize={'small'} iconType="timerFixed" />
      <SpacerSM />
      <span>{formatTimeLeft({ timeLeftMs })}</span>
    </StyledExpiresIn>
  );
};

export const MessageReactBar = ({ action, additionalAction, messageId }: Props) => {
  const recentReactions = getRecentReactions();
  const expirationTimestamp = useIsRenderedExpiresInItem(messageId);

  return (
    <StyledContainer expirationTimestamp={expirationTimestamp}>
      <StyledMessageReactBar>
        {recentReactions &&
          recentReactions.map(emoji => (
            <ReactButton
              key={emoji}
              role={'img'}
              aria-label={
                nativeEmojiData?.ariaLabels ? nativeEmojiData.ariaLabels[emoji] : undefined
              }
              onClick={() => {
                action(emoji);
              }}
            >
              {emoji}
            </ReactButton>
          ))}
        <SessionIconButton
          iconColor={'var(--emoji-reaction-bar-icon-color)'}
          iconPadding={'8px'}
          iconSize={'huge'}
          iconType="plusThin"
          backgroundColor={'var(--emoji-reaction-bar-icon-background-color)'}
          borderRadius="300px"
          onClick={additionalAction}
        />
      </StyledMessageReactBar>
      <ExpiresInItem expirationTimestamp={expirationTimestamp} />
    </StyledContainer>
  );
};
