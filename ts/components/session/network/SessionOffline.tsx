import React from 'react';
import styled from 'styled-components';
import { useNetwork } from './useNetwork';

type ContainerProps = {
  show: boolean;
};

const OfflineContainer = styled.div<ContainerProps>`
  background: ${props => props.theme.colors.accent};
  color: ${props => props.theme.colors.textColor};
  padding: ${props => (props.show ? props.theme.common.margins.sm : '0px')};
  margin: ${props => (props.show ? props.theme.common.margins.xs : '0px')};
  height: ${props => (props.show ? 'auto' : '0px')};
  overflow: hidden;
  transition: ${props => props.theme.common.animations.defaultDuration};
`;

const OfflineTitle = styled.h3`
  padding-top: 0px;
  margin-top: 0px;
`;

const OfflineMessage = styled.div``;

export const SessionOffline = () => {
  const isOnline = useNetwork();

  return (
    <OfflineContainer show={!isOnline}>
      <OfflineTitle>{window.i18n('offline')}</OfflineTitle>
      <OfflineMessage>{window.i18n('checkNetworkConnection')}</OfflineMessage>
    </OfflineContainer>
  );
};
