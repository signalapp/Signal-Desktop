import React, { useCallback, useEffect } from 'react';

import { isEmpty, isString } from 'lodash';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import { resetLeftOverlayMode, setLeftOverlayMode } from '../../../../state/ducks/section';

import { SessionIcon, SessionIconType } from '../../../icon';
import { ContactsListWithBreaks } from './ContactsListWithBreaks';

const StyledActionRow = styled.button`
  border: none;
  display: flex;
  align-items: center;
  border-bottom: 1px var(--border-color) solid;
  transition-duration: var(--default-duration);
  width: 100%;

  &:first-child {
    border-top: 1px var(--border-color) solid;
  }

  :hover {
    background: var(--conversation-tab-background-hover-color);
  }
`;

export const StyledChooseActionTitle = styled.span`
  color: var(--text-primary-color);
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
    dispatch(resetLeftOverlayMode());
  }

  const openNewMessage = useCallback(() => {
    dispatch(setLeftOverlayMode('message'));
  }, [dispatch]);

  const openCreateGroup = useCallback(() => {
    dispatch(setLeftOverlayMode('closed-group'));
  }, [dispatch]);

  const openJoinCommunity = useCallback(() => {
    dispatch(setLeftOverlayMode('open-group'));
  }, [dispatch]);

  useKey('Escape', closeOverlay);

  useEffect(() => {
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
    document?.addEventListener('paste', handlePaste);

    return () => {
      document?.removeEventListener('paste', handlePaste);
    };
  }, [openJoinCommunity, openNewMessage]);

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
