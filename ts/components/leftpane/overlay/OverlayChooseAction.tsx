import React from 'react';
// tslint:disable: use-simple-attributes no-submodule-imports

import { useDispatch } from 'react-redux';
import { resetOverlayMode, setOverlayMode } from '../../../state/ducks/section';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import { SessionIcon, SessionIconType } from '../../icon';

const StyledActionRow = styled.button`
  border: none;
  width: 100%;
  display: flex;
  align-items: center;
  border-bottom: 1px var(--color-session-border) solid;
  transition-duration: 0.25s;

  &:first-child {
    border-top: 1px var(--color-session-border) solid;
  }

  :hover {
    background: var(--color-clickable-hovered);
  }
`;

const StyledActionText = styled.span`
  color: var(--color-text);
  font-size: 18px;
  padding: 5px 0px 5px 10px;
`;

const StyledIcon = styled.div`
  width: 58px;
`;

const IconOnActionRow = (props: { iconType: SessionIconType }) => {
  return (
    <StyledIcon>
      <SessionIcon iconSize="medium" iconType={props.iconType} />
    </StyledIcon>
  );
};

export const OverlayChooseAction = () => {
  const dispatch = useDispatch();

  function closeOverlay() {
    dispatch(resetOverlayMode());
  }

  function openNewMessage() {
    dispatch(setOverlayMode('message'));
  }

  function openCreateGroup() {
    dispatch(setOverlayMode('closed-group'));
  }

  function openJoinCommunity() {
    dispatch(setOverlayMode('open-group'));
  }

  useKey('Escape', closeOverlay);

  return (
    <div className="module-left-pane-overlay">
      <StyledActionRow onClick={openNewMessage}>
        <IconOnActionRow iconType="chatBubble" />
        <StyledActionText>{window.i18n('newMessage')}</StyledActionText>
      </StyledActionRow>
      <StyledActionRow onClick={openCreateGroup}>
        <IconOnActionRow iconType="group" />
        <StyledActionText>{window.i18n('createGroup')}</StyledActionText>
      </StyledActionRow>
      <StyledActionRow onClick={openJoinCommunity}>
        <IconOnActionRow iconType="communities" />
        <StyledActionText>{window.i18n('joinOpenGroup')}</StyledActionText>
      </StyledActionRow>
    </div>
  );
};
