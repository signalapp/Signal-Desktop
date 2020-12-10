import React from 'react';

import styled, { DefaultTheme } from 'styled-components';
import { OpacityMetadataComponent } from './MessageMetadata';

export const MetadataSpacer = styled.span`
  flex-grow: 1;
`;

const MessageSendingErrorContainer = styled(props => (
  <OpacityMetadataComponent {...props} />
))<{ withImageNoCaption: boolean; theme: DefaultTheme }>`
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  user-select: none;
  color: ${props =>
    props.withImageNoCaption ? 'white' : props.theme.colors.sentMessageText};
`;
export const MessageSendingErrorText = (props: {
  withImageNoCaption: boolean;
  theme: DefaultTheme;
}) => {
  return (
    <MessageSendingErrorContainer {...props}>
      {window.i18n('sendFailed')}
    </MessageSendingErrorContainer>
  );
};
