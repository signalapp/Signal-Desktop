import styled, { ThemeContext } from 'styled-components';
import React, { useContext } from 'react';
import {
  SessionIcon,
  SessionIconSize,
  SessionIconType,
} from '../../session/icon';

export const MetadataSpacer = styled.span`
  flex-grow: 1;
`;

const MessageReadReceiptContainer = styled.div`
  margin-inline-start: 5px;
`;

export const MessageReadReceipt = () => {
  const theme = useContext(ThemeContext);
  return (
    <MessageReadReceiptContainer>
      <SessionIcon
        iconType={SessionIconType.Check}
        iconSize={SessionIconSize.Small}
        theme={theme}
      />
    </MessageReadReceiptContainer>
  );
};
