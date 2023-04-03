import React from 'react';
import styled from 'styled-components';
import { Flex } from './basic/Flex';

const StyledNoticeBanner = styled(Flex)`
  background-color: var(--primary-color);
  color: var(--background-primary-color);
  min-height: 30px;
  font-size: var(--font-size-lg);
  padding: 0 var(--margins-sm);
  text-align: center;
`;

type NoticeBannerProps = {
  text: string;
};

export const NoticeBanner = (props: NoticeBannerProps) => {
  const { text } = props;

  return (
    <StyledNoticeBanner
      container={true}
      flexDirection={'row'}
      justifyContent={'center'}
      alignItems={'center'}
    >
      {text}
    </StyledNoticeBanner>
  );
};
