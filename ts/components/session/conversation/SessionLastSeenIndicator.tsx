import React from 'react';
import styled from 'styled-components';

interface LastSeenProps {
  show: boolean;
}

const LastSeenBarContainer = styled.div<LastSeenProps>`
  padding-bottom: ${props => (props.show ? '35px' : 0)};
  margin-inline-start: 28px;
  padding-top: ${props => (props.show ? '28px' : 0)};
  transition: ${props => props.theme.common.animations.defaultDuration};
  overflow: hidden;
  height: ${props => (props.show ? 'auto' : 0)};
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

export const SessionLastSeenIndicator = ({
  count,
  show,
}: {
  count: number;
  show: boolean;
}) => {
  const { i18n } = window;
  const text =
    count > 1 ? i18n('unreadMessages', count) : i18n('unreadMessage', count);
  return (
    <LastSeenBarContainer show={show}>
      <LastSeenBar>
        <LastSeenText>{text}</LastSeenText>
      </LastSeenBar>
    </LastSeenBarContainer>
  );
};
