import React from 'react';
import styled from 'styled-components';

type Props = {
  count?: number;
};

const StyledCountContainer = styled.div<{ shouldRender: boolean, unreadCount?: number }>`
  position: absolute;
  font-size: 18px;
  line-height: 1.2;
  top: ${props => (props.unreadCount ? '29' : '27')}px;
  left: ${props => (props.unreadCount
    ? (15 - props.unreadCount.toString().length * 2).toString()
    : '28'
  )}px;
  padding: 3px 3px;
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-default);
  border-radius: 58px;
  font-weight: 700;
  background: var(--unread-messages-alert-background-color);
  transition: var(--default-duration);
  opacity: ${props => (props.shouldRender ? 1 : 0)};
  text-align: center;
  color: var(--unread-messages-alert-text-color);
`;

const StyledCount = styled.div`
  position: relative;
  font-size: 0.6rem;
`;

export const SessionNotificationCount = (props: Props) => {
  const { count } = props;
  const overflow = Boolean(count && count > 99);
  const shouldRender = Boolean(count && count > 0);

  if (overflow) {
    return (
      <StyledCountContainer shouldRender={shouldRender}>
        <StyledCount>
          {99}
          <span>+</span>
        </StyledCount>
      </StyledCountContainer>
    );
  }
  return (
    <StyledCountContainer shouldRender={shouldRender}>
      <StyledCount>{count}</StyledCount>
    </StyledCountContainer>
  );
};

export const SessionUnreadCount = (props: Props) => {
  const { count } = props;
  const shouldRender = Boolean(count && count > 0);

  return (
    <StyledCountContainer shouldRender={shouldRender} unreadCount={count}>
      <StyledCount>{count}</StyledCount>
    </StyledCountContainer>
  );
};
