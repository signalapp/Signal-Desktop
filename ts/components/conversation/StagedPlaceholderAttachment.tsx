import React, { MouseEvent } from 'react';
import styled from 'styled-components';

interface Props {
  onClick: (e: MouseEvent<HTMLDivElement>) => void;
}

const StyledStagedPlaceholderAttachment = styled.div`
  margin: 1px var(--margins-sm);
  border-radius: var(--border-radius-message-box);
  border: 1px solid var(--border-color);
  height: 120px;
  width: 120px;
  display: inline-block;
  vertical-align: middle;
  cursor: pointer;
  position: relative;

  &:hover {
    background-color: var(--background-secondary-color);
  }
`;

export const StagedPlaceholderAttachment = (props: Props) => {
  const { onClick } = props;

  return (
    <StyledStagedPlaceholderAttachment role="button" onClick={onClick}>
      <div className="module-staged-placeholder-attachment__plus-icon" />
    </StyledStagedPlaceholderAttachment>
  );
};
