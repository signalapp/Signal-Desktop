import React from 'react';
import styled from 'styled-components';
import { Flex } from './basic/Flex';
import { SessionIconButton } from './icon';

const StyledNoticeBanner = styled(Flex)`
  position: relative;
  background-color: var(--primary-color);
  color: var(--black-color);
  font-size: var(--font-size-md);
  padding: var(--margins-xs) var(--margins-sm);
  text-align: center;
  flex-shrink: 0;
  .session-icon-button {
    position: absolute;
    right: var(--margins-sm);
  }
`;

const StyledText = styled.span`
  margin-right: var(--margins-lg);
`;

type NoticeBannerProps = {
  text: string;
  dismissCallback: () => void;
};

export const NoticeBanner = (props: NoticeBannerProps) => {
  const { text, dismissCallback } = props;

  return (
    <StyledNoticeBanner
      container={true}
      flexDirection={'row'}
      justifyContent={'center'}
      alignItems={'center'}
    >
      <StyledText>{text}</StyledText>
      <SessionIconButton
        iconType="exit"
        iconColor="inherit"
        iconSize="small"
        onClick={event => {
          event?.preventDefault();
          dismissCallback();
        }}
      />
    </StyledNoticeBanner>
  );
};
