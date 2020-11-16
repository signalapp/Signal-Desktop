import React from 'react';
import styled from 'styled-components';

const SessionExpiredWarningContainer = styled.div`
  background: ${props => props.theme.colors.destructive};
  color: black;
  padding: ${props => props.theme.common.margins.sm};
  margin: ${props => props.theme.common.margins.xs};
`;

const SessionExpiredWarningLink = styled.a`
  color: black;
`;

export const SessionExpiredWarning = () => {
  return (
    <SessionExpiredWarningContainer>
      <div>{window.i18n('expiredWarning')}</div>
      <SessionExpiredWarningLink
        href={'https://getsession.org'}
        target="_blank"
        rel="noopener noreferrer"
      >
        {window.i18n('upgrade')}
      </SessionExpiredWarningLink>
    </SessionExpiredWarningContainer>
  );
};
