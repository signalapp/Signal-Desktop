import React from 'react';
import styled from 'styled-components';

type Props = {
  count?: number;
};

const StyledCountContainer = styled.div<{ shouldRender: boolean }>`
  position: absolute;
  width: 24px;
  height: 12px;
  font-size: 18px;
  top: 27px;
  right: 8px;
  padding: 3px;
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

const StyledCount = styled.div<{ countOverflow: boolean }>`
  position: relative;
  font-size: ${props => (props.countOverflow ? '0.5em' : '0.6em')};
  margin-top: ${props => (props.countOverflow ? '0.35em' : '0em')};
  margin-left: ${props => (props.countOverflow ? '-0.45em' : '0em')};
`;

const StyledCountSup = styled.div`
  position: absolute;
  font-size: 1.3em;
  top: -0.5em;
  margin-inline-start: 0.375em;
`;

export const SessionNotificationCount = (props: Props) => {
  const { count } = props;
  const overflow = Boolean(count && count > 9);
  const shouldRender = Boolean(count && count > 0);

  if (overflow) {
    return (
      <StyledCountContainer shouldRender={shouldRender}>
        <StyledCount countOverflow={overflow}>
          {9}
          <StyledCountSup>+</StyledCountSup>
        </StyledCount>
      </StyledCountContainer>
    );
  }
  return (
    <StyledCountContainer shouldRender={shouldRender}>
      <StyledCount countOverflow={overflow}>{count}</StyledCount>
    </StyledCountContainer>
  );
};
