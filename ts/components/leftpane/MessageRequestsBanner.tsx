import React from 'react';
import { contextMenu } from 'react-contexify';
import { createPortal } from 'react-dom';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getUnreadConversationRequests } from '../../state/selectors/conversations';
import { getHideMessageRequestBanner } from '../../state/selectors/userConfig';
import { SessionIcon, SessionIconSize, SessionIconType } from '../icon';
import { MemoMessageRequestBannerContextMenu } from '../menu/MessageRequestBannerContextMenu';

const StyledMessageRequestBanner = styled.div`
  height: 64px;
  width: 100%;
  max-width: 300px;
  display: flex;
  flex-direction: row;
  padding: 8px 12px; // adjusting for unread border always being active
  align-items: center;
  cursor: pointer;

  background: var(--color-request-banner-background);

  transition: var(--session-transition-duration);

  &:hover {
    background: var(--color-clickable-hovered);
  }
`;

const StyledMessageRequestBannerHeader = styled.span`
  font-weight: bold;
  font-size: 15px;
  color: var(--color-text-subtle);
  padding-left: var(--margins-xs);
  margin-inline-start: 12px;
  line-height: 18px;
  overflow-x: hidden;
  overflow-y: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const StyledCircleIcon = styled.div`
  padding-left: var(--margins-xs);
`;

const StyledUnreadCounter = styled.div`
  font-weight: bold;
  border-radius: var(--margins-sm);
  background-color: var(--color-request-banner-unread-background);
  margin-left: 10px;
  min-width: 20px;
  height: 20px;
  line-height: 25px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: var(--margins-xs);
`;

const StyledGridContainer = styled.div`
  display: flex;
  width: 36px;
  height: 36px;
  align-items: center;
  border-radius: 50%;
  justify-content: center;
  background-color: var(--color-request-banner-icon-background);
`;

export const CirclularIcon = (props: { iconType: SessionIconType; iconSize: SessionIconSize }) => {
  const { iconSize, iconType } = props;

  return (
    <StyledCircleIcon>
      <StyledGridContainer>
        <SessionIcon
          iconType={iconType}
          iconSize={iconSize}
          iconColor="var(--color-request-banner-icon)"
        />
      </StyledGridContainer>
    </StyledCircleIcon>
  );
};

export const MessageRequestsBanner = (props: { handleOnClick: () => any }) => {
  const { handleOnClick } = props;
  const conversationRequestsUnread = useSelector(getUnreadConversationRequests).length;
  const hideRequestBanner = useSelector(getHideMessageRequestBanner);

  if (!conversationRequestsUnread || hideRequestBanner) {
    return null;
  }

  const triggerId = 'msg-req-banner';

  const handleOnContextMenu = (e: any) => {
    contextMenu.show({
      id: triggerId,
      event: e,
    });
  };

  const openRequests = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 0) {
      handleOnClick();
    }
  };

  return (
    <>
      <StyledMessageRequestBanner
        onContextMenu={handleOnContextMenu}
        onClick={openRequests}
        onMouseUp={e => {
          e.stopPropagation();
          e.preventDefault();
        }}
        data-testid="message-request-banner"
      >
        <CirclularIcon iconType="messageRequest" iconSize="medium" />
        <StyledMessageRequestBannerHeader>
          {window.i18n('messageRequests')}
        </StyledMessageRequestBannerHeader>
        <StyledUnreadCounter>
          <div>{conversationRequestsUnread || 0}</div>
        </StyledUnreadCounter>
      </StyledMessageRequestBanner>
      <Portal>
        <MemoMessageRequestBannerContextMenu triggerId={triggerId} />
      </Portal>
    </>
  );
};

const Portal = ({ children }: { children: any }) => {
  return createPortal(children, document.querySelector('.inbox.index') as Element);
};
