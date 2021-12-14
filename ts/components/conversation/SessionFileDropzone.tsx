import React from 'react';
import styled from 'styled-components';
import { Flex } from '../basic/Flex';
import { SessionIcon } from '../icon';

const DropZoneContainer = styled.div`
  display: inline-block;
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

const DropZoneWithBorder = styled.div`
  border: dashed 4px var(--color-accent);
  background-color: var(--color-clickable-hovered);
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  opacity: 0.5;
  pointer-events: none;
`;

export const SessionFileDropzone = () => {
  return (
    <DropZoneContainer>
      <DropZoneWithBorder>
        <Flex container={true} justifyContent="space-around" height="100%" alignItems="center">
          <SessionIcon iconSize={'max'} iconType="circlePlus" />
        </Flex>
      </DropZoneWithBorder>
    </DropZoneContainer>
  );
};
