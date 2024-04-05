import React from 'react';
import styled from 'styled-components';
import { Constants } from '../../session';

type Props = {
  overflowingAt: number;
  centeredOnTop: boolean;
  count?: number;
};
const StyledCountContainer = styled.div<{ centeredOnTop: boolean }>`
  position: absolute;
  font-size: 18px;
  line-height: 1.2;
  top: ${props => (props.centeredOnTop ? '-10px' : '27px')};
  left: ${props => (props.centeredOnTop ? '50%' : '28px')};
  transform: ${props => (props.centeredOnTop ? 'translateX(-50%)' : 'none')};
  padding: ${props => (props.centeredOnTop ? '3px 3px' : '1px 4px')};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-default);
  border-radius: 58px;
  font-weight: 700;
  background: var(--unread-messages-alert-background-color);
  transition: var(--default-duration);
  text-align: center;
  color: var(--unread-messages-alert-text-color);
  white-space: ${props => (props.centeredOnTop ? 'nowrap' : 'normal')};
`;

const StyledCount = styled.div<{ centeredOnTop: boolean }>`
  position: relative;
  font-size: ${props => (props.centeredOnTop ? 'var(--font-size-xs)' : '0.6rem')};
`;

const OverflowingAt = (props: { overflowingAt: number }) => {
  return (
    <>
      {props.overflowingAt}
      <span>+</span>
    </>
  );
};

const NotificationOrUnreadCount = ({ centeredOnTop, overflowingAt, count }: Props) => {
  if (!count) {
    return null;
  }
  const overflowing = count > overflowingAt;

  return (
    <StyledCountContainer centeredOnTop={centeredOnTop}>
      <StyledCount centeredOnTop={centeredOnTop}>
        {overflowing ? <OverflowingAt overflowingAt={overflowingAt} /> : count}
      </StyledCount>
    </StyledCountContainer>
  );
};

export const SessionNotificationCount = (props: Pick<Props, 'count'>) => {
  return (
    <NotificationOrUnreadCount
      centeredOnTop={false}
      overflowingAt={Constants.CONVERSATION.MAX_GLOBAL_UNREAD_COUNT}
      count={props.count}
    />
  );
};

export const SessionUnreadCount = (props: Pick<Props, 'count'>) => {
  return (
    <NotificationOrUnreadCount
      centeredOnTop={true}
      overflowingAt={Constants.CONVERSATION.MAX_CONVO_UNREAD_COUNT}
      count={props.count}
    />
  );
};
