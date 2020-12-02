import styled from 'styled-components';
import React from 'react';
import {
  SessionIcon,
  SessionIconSize,
  SessionIconType,
} from '../../session/icon';

export const MetadataSpacer = styled.span`
  flex-grow: 1;
`;
/* .session-icon.check {
  @include themify($themes) {
    fill: subtle(themed("sentMessageText"));
  } */

const MessageReadReceiptContainer = styled.div`
  margin-inline-start: 5px;
`;

export const MessageReadReceipt = () => {
  return (
    <MessageReadReceiptContainer>
      <SessionIcon
        iconType={SessionIconType.Check}
        iconSize={SessionIconSize.Small}
      />
    </MessageReadReceiptContainer>
  );
};
