import styled from 'styled-components';
import { Constants } from '../../session';

type Props = {
  overflowingAt: number;
  centeredOnTop: boolean;
  count?: number;
};
const StyledCountContainer = styled.div<{ centeredOnTop: boolean }>`
  background: var(--unread-messages-alert-background-color);
  color: var(--unread-messages-alert-text-color);
  text-align: center;

  padding: ${props => (props.centeredOnTop ? '1px 3px 0' : '1px 4px')};

  position: absolute;
  top: ${props => (props.centeredOnTop ? '-10px' : '27px')};
  left: ${props => (props.centeredOnTop ? '50%' : '28px')};

  font-size: var(--font-size-xs);
  font-family: var(--font-default);
  font-weight: 700;

  height: 16px;
  min-width: 16px;
  line-height: 16px;
  border-radius: 8px;

  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  transition: var(--default-duration);
  transform: ${props => (props.centeredOnTop ? 'translateX(-50%)' : 'none')};
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
