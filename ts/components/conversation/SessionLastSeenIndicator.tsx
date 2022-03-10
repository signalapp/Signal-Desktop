import React, { useContext, useLayoutEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getQuotedMessageToAnimate } from '../../state/selectors/conversations';
import { ScrollToLoadedMessageContext } from './SessionMessagesListContainer';

const LastSeenBarContainer = styled.div`
  padding-bottom: 35px;
  max-width: 300px;
  align-self: center;
  padding-top: 28px;
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const LastSeenBar = styled.div`
  height: 2px;
  background-color: var(--color-last-seen-indicator);
  flex-grow: 1;
  min-width: 60px;
  flex-shrink: 0;
`;

const LastSeenText = styled.div`
  margin-top: 3px;
  font-size: 11px;
  line-height: 26px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  text-align: center;
  flex-shrink: 0;
  margin-inline: 1rem;

  color: var(--color-last-seen-indicator);
`;

export const SessionLastSeenIndicator = (props: { messageId: string }) => {
  // if this unread-indicator is not unique it's going to cause issues
  const [didScroll, setDidScroll] = useState(false);
  const quotedMessageToAnimate = useSelector(getQuotedMessageToAnimate);

  const scrollToLoadedMessage = useContext(ScrollToLoadedMessageContext);

  // if this unread-indicator is rendered,
  // we want to scroll here only if the conversation was not opened to a specific message

  useLayoutEffect(() => {
    if (!quotedMessageToAnimate && !didScroll) {
      scrollToLoadedMessage(props.messageId, 'unread-indicator');
      setDidScroll(true);
    } else if (quotedMessageToAnimate) {
      setDidScroll(true);
    }
  });

  return (
    <LastSeenBarContainer id="unread-indicator">
      <LastSeenBar />
      <LastSeenText>{window.i18n('unreadMessages')}</LastSeenText>

      <LastSeenBar />
    </LastSeenBarContainer>
  );
};
