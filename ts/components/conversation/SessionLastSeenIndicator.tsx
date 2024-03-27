import React, { useLayoutEffect } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { useScrollToLoadedMessage } from '../../contexts/ScrollToLoadedMessage';
import { getQuotedMessageToAnimate } from '../../state/selectors/conversations';
import { isDarkTheme } from '../../state/selectors/theme';

const LastSeenBar = styled.div`
  height: 2px;
  flex-grow: 1;
  min-width: 60px;
  flex-shrink: 0;
`;

const LastSeenText = styled.div`
  margin-top: 3px;
  font-size: var(--font-size-xs);
  font-weight: 500;
  line-height: 26px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  text-align: center;
  flex-shrink: 0;
  margin-inline: 1rem;
`;

const LastSeenBarContainer = styled.div<{ darkMode?: boolean }>`
  padding-bottom: 35px;
  max-width: 300px;
  align-self: center;
  margin: 0 auto;
  padding-top: 28px;
  display: flex;
  flex-direction: row;
  align-items: center;

  ${LastSeenBar} {
    background-color: ${props =>
      props.darkMode ? 'var(--primary-color)' : 'var(--text-primary-color)'};
  }

  ${LastSeenText} {
    color: ${props => (props.darkMode ? 'var(--primary-color)' : 'var(--text-primary-color)')};
  }
`;

export const SessionLastSeenIndicator = (props: {
  messageId: string;
  didScroll: boolean;
  setDidScroll: (scroll: boolean) => void;
}) => {
  const darkMode = useSelector(isDarkTheme);
  // if this unread-indicator is not unique it's going to cause issues
  const quotedMessageToAnimate = useSelector(getQuotedMessageToAnimate);
  const scrollToLoadedMessage = useScrollToLoadedMessage();

  const { messageId, didScroll, setDidScroll } = props;

  /**
   * If this unread-indicator is rendered, we want to scroll here only if:
   * 1. the conversation was not opened to a specific message (quoted message)
   * 2. we already scrolled to this unread banner once for this convo https://github.com/oxen-io/session-desktop/issues/2308
   *
   * To achieve 2. we store the didScroll state in the parent and track the last rendered conversation in it.
   */

  useLayoutEffect(() => {
    if (!quotedMessageToAnimate && !didScroll) {
      scrollToLoadedMessage(messageId, 'unread-indicator');
      setDidScroll(true);
    } else if (quotedMessageToAnimate) {
      setDidScroll(true);
    }
  });

  return (
    <LastSeenBarContainer id="unread-indicator" darkMode={darkMode}>
      <LastSeenBar />
      <LastSeenText>{window.i18n('unreadMessages')}</LastSeenText>

      <LastSeenBar />
    </LastSeenBarContainer>
  );
};
