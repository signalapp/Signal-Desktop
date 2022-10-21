import React from 'react';
import styled from 'styled-components';

type Props = {
  count?: number;
};

const StyledCountContainer = styled.div<{ shouldRender: boolean }>`
  position: absolute;
  font-size: 18px;
  top: 27px;
  right: 8px;
  padding: 0 6px;
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
  font-size: 0.6em;
`;

export const SessionNotificationCount = (props: Props) => {
  const { count } = props;
  const overflow = Boolean(count && count > 9);
  const shouldRender = Boolean(count && count > 0);

  if (overflow) {
    return (
      <StyledCountContainer shouldRender={shouldRender}>
        <StyledCount>
          {9}
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
