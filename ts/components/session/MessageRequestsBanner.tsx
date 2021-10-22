import React from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { getLeftPaneLists } from '../../state/selectors/conversations';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';

const StyledMessageRequestBanner = styled.div`
  border-left: var(--border-unread);
  height: 64px;
  width: 100%;
  max-width: 300px;
  display: flex;
  flex-direction: row;
  padding: 8px 16px;
  align-items: center;
  cursor: pointer;

  transition: var(--session-transition-duration);

  &:hover {
    background: var(--color-clickable-hovered);
  }
`;

const StyledMessageRequestBannerHeader = styled.span`
  font-weight: bold;
  font-size: 15px;
  color: var(--color-text-subtle);
  padding-left: var(--margin-xs);
  margin-inline-start: 12px;
  margin-top: var(--margin-sm);
  line-height: 18px;
  overflow-x: hidden;
  overflow-y: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const StyledCircleIcon = styled.div`
  padding-left: var(--margin-xs);
`;

const StyledUnreadCounter = styled.div`
  font-weight: bold;
  border-radius: 50%;
  background-color: var(--color-clickable-hovered);
  margin-left: 10px;
  width: 20px;
  height: 20px;
  line-height: 25px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

const StyledGridContainer = styled.div`
  border: solid 1px black;
  display: flex;
  width: 36px;
  height: 36px;
  align-items: center;
  border-radius: 50%;
  justify-content: center;
  background-color: var(--color-conversation-item-has-unread);
`;

export const CirclularIcon = (props: { iconType: SessionIconType; iconSize: SessionIconSize }) => {
  const { iconSize, iconType } = props;

  return (
    <StyledCircleIcon>
      <StyledGridContainer>
        <SessionIcon
          iconType={iconType}
          iconSize={iconSize}
          iconColor={'var(--color-text-subtle)'}
        />
      </StyledGridContainer>
    </StyledCircleIcon>
  );
};

export const MessageRequestsBanner = (props: { handleOnClick: () => any }) => {
  const { handleOnClick } = props;
  const convos = useSelector(getLeftPaneLists).conversations;
  const pendingRequestsCount = (convos.filter(c => c.isApproved !== true) || []).length;

  if (!pendingRequestsCount) {
    return null;
  }

  return (
    <StyledMessageRequestBanner onClick={handleOnClick}>
      <CirclularIcon iconType={'bell'} iconSize="medium" />
      <StyledMessageRequestBannerHeader>Message Requests</StyledMessageRequestBannerHeader>
      <StyledUnreadCounter>
        <div>{pendingRequestsCount}</div>
      </StyledUnreadCounter>
    </StyledMessageRequestBanner>
  );
};
