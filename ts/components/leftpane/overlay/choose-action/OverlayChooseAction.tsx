import React, { useEffect } from 'react';
// tslint:disable: use-simple-attributes no-submodule-imports

import { useDispatch } from 'react-redux';
import { resetOverlayMode, setOverlayMode } from '../../../../state/ducks/section';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import { SessionIcon, SessionIconType } from '../../../icon';
import { ContactsListWithBreaks } from './ContactsListWithBreaks';
import { isEmpty, isString } from 'lodash';

const StyledActionRow = styled.button`
  border: none;
  display: flex;
  align-items: center;
  border-bottom: 1px var(--color-session-border) solid;
  transition-duration: 0.25s;
  width: 100%;

  &:first-child {
    border-top: 1px var(--color-session-border) solid;
  }

  :hover {
    background: var(--color-clickable-hovered);
  }
`;

export const StyledChooseActionTitle = styled.span`
  color: var(--color-text);
  font-size: 18px;
  padding: var(--margins-xs) var(--margins-lg);
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

  function handlePaste(event: ClipboardEvent) {
    event.preventDefault();

    const pasted = event.clipboardData?.getData('text');

    if (pasted && isString(pasted) && !isEmpty(pasted)) {
      if (pasted.startsWith('http') || pasted.startsWith('https')) {
        openJoinCommunity();
      } else if (pasted.startsWith('05')) {
        openNewMessage();
      }
    }
  }

  useEffect(() => {
    document?.addEventListener('paste', handlePaste);

    return () => {
      document?.removeEventListener('paste', handlePaste);
    };
  }, []);

  return (
    <div className="module-left-pane-overlay">
      <StyledActionRow
        onClick={openNewMessage}
        data-testid="chooser-new-conversation-button"
        aria-label={window.i18n('createConversationNewContact')}
      >
        <IconOnActionRow iconType="chatBubble" />
        <StyledChooseActionTitle>{window.i18n('newMessage')}</StyledChooseActionTitle>
      </StyledActionRow>
      <StyledActionRow
        onClick={openCreateGroup}
        data-testid="chooser-new-group"
        aria-label={window.i18n('createConversationNewGroup')}
      >
        <IconOnActionRow iconType="group" />
        <StyledChooseActionTitle>{window.i18n('createGroup')}</StyledChooseActionTitle>
      </StyledActionRow>
      <StyledActionRow
        onClick={openJoinCommunity}
        data-testid="chooser-new-community"
        aria-label={window.i18n('joinACommunity')}
      >
        <IconOnActionRow iconType="communities" />
        <StyledChooseActionTitle>{window.i18n('joinOpenGroup')}</StyledChooseActionTitle>
      </StyledActionRow>
      <ContactsListWithBreaks />
    </div>
  );
};
