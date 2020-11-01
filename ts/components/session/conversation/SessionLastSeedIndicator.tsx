import React from 'react';
import styled from 'styled-components';

const LastSeenBarContainer = styled.div`
  padding-top: 25px;
  padding-bottom: 35px;
  margin-inline-start: 28px;
  padding-top: 28px;
`;

const LastSeenBar = styled.div`
  width: 100%;
  height: 2px;
  background-color: ${props => props.theme.colors.lastSeenIndicatorColor};
`;

const LastSeenText = styled.div`
  margin-top: 3px;
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  text-align: center;

  color: ${props => props.theme.colors.lastSeenIndicatorTextColor};
`;

export const SessionLastSeenIndicator = ({ count }: { count: number }) => {
  const { i18n } = window;
  const text =
    count > 1 ? i18n('unreadMessages', count) : i18n('unreadMessage', count);
  return (
    <LastSeenBarContainer>
      <LastSeenBar>
        <LastSeenText>{text}</LastSeenText>
      </LastSeenBar>
    </LastSeenBarContainer>
  );
};
