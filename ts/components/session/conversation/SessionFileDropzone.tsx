import React, { useContext } from 'react';
import styled, { ThemeContext } from 'styled-components';
import { Flex } from '../Flex';
import { SessionIcon, SessionIconSize, SessionIconType } from '../icon';

// padding-inline-end: ${props => props.theme.common.margins.md};
// padding-inline-start: ${props => props.theme.common.margins.md};

const DropZoneContainer = styled.div`
  display: inline-block;
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;

const DropZoneWithBorder = styled.div`
  border: dashed 4px ${props => props.theme.colors.accent};
  background-color: ${props => props.theme.colors.clickableHovered};
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
  const themeContext = useContext(ThemeContext);

  return (
    <DropZoneContainer>
      <DropZoneWithBorder>
        <Flex
          container={true}
          justifyContent="space-around"
          height="100%"
          alignItems="center"
        >
          <SessionIcon
            iconSize={SessionIconSize.Max}
            iconType={SessionIconType.CirclePlus}
            theme={themeContext}
          />
        </Flex>
      </DropZoneWithBorder>
    </DropZoneContainer>
  );
};
