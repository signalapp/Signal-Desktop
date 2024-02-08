import React, { ReactElement } from 'react';
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
  box-shadow: 0 2px 16px 0 rgba(0, 0, 0, 0.2), 0 0px 20px 0 rgba(0, 0, 0, 0.19);

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

function formatExpiry({ diffMs }: { diffMs: number }) {
  const diff = moment(diffMs).utc();

  if (diffMs <= 0) {
    return `0s`;
  }

  const prefix = 'Message will expire in';

  if (diff.isBefore(moment.utc(0).add(1, 'minute'))) {
    return `${prefix} ${diff.seconds()}s`;
  }

  if (diff.isBefore(moment.utc(0).add(1, 'hour'))) {
    const extraUnit = diff.seconds() ? ` ${diff.seconds()}s` : '';
    return `${prefix} ${diff.minutes()}m${extraUnit}`;
  }

  if (diff.isBefore(moment.utc(0).add(1, 'day'))) {
    const extraUnit = diff.minutes() ? ` ${diff.minutes()}m` : '';
    return `${prefix} ${diff.hours()}h${extraUnit}`;
  }

  if (diff.isBefore(moment.utc(0).add(7, 'day'))) {
    const extraUnit = diff.hours() ? ` ${diff.hours()}h` : '';
    return `${prefix} ${diff.dayOfYear() - 1}d${extraUnit}`;
  }

  if (diff.isBefore(moment.utc(0).add(31, 'day'))) {
    const days = diff.dayOfYear() - 1;
    const weeks = Math.floor(days / 7);
    const daysLeft = days % 7;
    const extraUnit = daysLeft ? ` ${daysLeft}d` : '';
    return `${prefix} ${weeks}w${extraUnit}`;
  }

  return '...';
}

const ExpiresInItem = ({ expirationTimestamp }: { expirationTimestamp?: number | null }) => {
  // this boolean is just used to forceRefresh the state when we get to display seconds in the contextmenu
  const [refresh, setRefresh] = useBoolean(false);
  const diffMs = (expirationTimestamp || 0) - Date.now();

  useInterval(
    () => {
      setRefresh(!refresh);
    },
    diffMs > 0 && diffMs <= 2 * DURATION.MINUTES ? 500 : null
  );
  if (!expirationTimestamp || diffMs < 0) {
    return null;
  }

  return (
    <StyledExpiresIn>
      <SessionIcon iconSize={'small'} iconType="stopwatch" />
      <SpacerSM />
      <span>{formatExpiry({ diffMs })}</span>
    </StyledExpiresIn>
  );
};

export const MessageReactBar = ({ action, additionalAction, messageId }: Props): ReactElement => {
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
