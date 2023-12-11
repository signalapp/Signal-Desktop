import React from 'react';
import styled from 'styled-components';

type Props = {
  count?: number;
};
const StyledCountContainer = styled.div<{ shouldRender: boolean; unreadCount?: number }>`
  position: absolute;
  font-size: 18px;
  line-height: 1.2;
  top: ${props => (props.unreadCount ? '-10px' : '27px')};
  left: ${props => (props.unreadCount ? '50%' : '28px')};
  transform: ${props => (props.unreadCount ? 'translateX(-50%)' : 'none')};
  padding: ${props => (props.unreadCount ? '3px 3px' : '1px 4px')};
  opacity: ${props => (props.shouldRender ? 1 : 0)};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-default);
  border-radius: 58px;
  font-weight: 700;
  background: var(--unread-messages-alert-background-color);
  transition: var(--default-duration);
  text-align: center;
  color: var(--unread-messages-alert-text-color);
  white-space: ${props => (props.unreadCount ? 'nowrap' : 'normal')};
`;

const StyledCount = styled.div<{ unreadCount?: number }>`
  position: relative;
  font-size: ${props => (props.unreadCount ? 'var(--font-size-xs)' : '0.6rem')};
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
      <StyledCount unreadCount={count}>{count}</StyledCount>
    </StyledCountContainer>
  );
};
