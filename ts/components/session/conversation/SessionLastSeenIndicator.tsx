import React from 'react';
import styled from 'styled-components';

const LastSeenBarContainer = styled.div`
  padding-bottom: 35px;
  margin-inline-start: 10rem;
  margin-inline-end: 10rem;
  padding-top: 28px;
  overflow: hidden;
`;

const LastSeenBar = styled.div`
  width: 100%;
  height: 2px;
  background-color: ${props => props.theme.colors.lastSeenIndicatorColor};
`;

const LastSeenText = styled.div`
  margin-top: 3px;
  font-size: 11px;
  line-height: 26px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  text-align: center;

  color: ${props => props.theme.colors.lastSeenIndicatorTextColor};
`;

export const SessionLastSeenIndicator = () => {
  const { i18n } = window;
  const text = i18n('unreadMessages');
  // if this unread-indicator is not unique it's going to cause issues
  return (
    <LastSeenBarContainer id="unread-indicator">
      <LastSeenBar>
        <LastSeenText>{text}</LastSeenText>
      </LastSeenBar>
    </LastSeenBarContainer>
  );
};
