import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getShowScrollButton } from '../state/selectors/conversations';

import { useSelectedUnreadCount } from '../state/selectors/selectedConversation';
import { SessionIconButton } from './icon';
import { SessionUnreadCount } from './icon/SessionNotificationCount';

const SessionScrollButtonDiv = styled.div`
  position: fixed;
  z-index: 2;
  right: 60px;
  animation: fadein var(--default-duration);

  .session-icon-button {
    background-color: var(--message-bubbles-received-background-color);
    box-shadow: var(--scroll-button-shadow);
  }
`;

export const SessionScrollButton = (props: { onClickScrollBottom: () => void }) => {
  const show = useSelector(getShowScrollButton);
  const unreadCount = useSelectedUnreadCount();

  return (
    <SessionScrollButtonDiv>
      <SessionIconButton
        iconType="chevron"
        iconSize={'huge'}
        isHidden={!show}
        onClick={props.onClickScrollBottom}
        dataTestId="scroll-to-bottom-button"
      >
        {Boolean(unreadCount) && <SessionUnreadCount count={unreadCount} />}
      </SessionIconButton>
    </SessionScrollButtonDiv>
  );
};
