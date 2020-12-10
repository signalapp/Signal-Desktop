import React from 'react';
import styled from 'styled-components';

type Props = {
  count?: number;
};

const StyledCountContainer = styled.div<{ shouldRender: boolean }>`
  position: absolute;
  width: 20px;
  height: 20px;
  font-size: 20px;
  top: ${props => props.theme.common.margins.lg};
  right: ${props => props.theme.common.margins.lg};
  padding: 3px;
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${props => props.theme.common.fonts.sessionFontDefault};
  border-radius: 50%;
  font-weight: 700;
  background: ${props => props.theme.colors.destructive};
  transition: ${props => props.theme.common.animations.defaultDuration};
  opacity: ${props => (props.shouldRender ? 1 : 0)};
  text-align: center;
  color: white;
  /* cursor:  */
`;

const StyledCount = styled.div<{ overflow: boolean }>`
  position: relative;
  font-size: ${props => (props.overflow ? '0.5em' : '0.6em')};
  margin-top: ${props => (props.overflow ? '0.35em' : '0em')};
  margin-left: ${props => (props.overflow ? '-0.45em' : '0em')};
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
        <StyledCount overflow={overflow}>
          {9}
          <StyledCountSup>+</StyledCountSup>
        </StyledCount>
      </StyledCountContainer>
    );
  }
  return (
    <StyledCountContainer shouldRender={shouldRender}>
      <StyledCount overflow={overflow}>{count}</StyledCount>
    </StyledCountContainer>
  );
};
