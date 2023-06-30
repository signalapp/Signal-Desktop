import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  deleteMessagesById,
  deleteMessagesByIdForEveryone,
} from '../../../interactions/conversations/unsendingInteractions';
import { resetSelectedMessageIds } from '../../../state/ducks/conversations';
import {
  getSelectedMessageIds,
  useSelectedConversationKey,
  useSelectedIsPublic,
} from '../../../state/selectors/conversations';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonShape,
  SessionButtonType,
} from '../../basic/SessionButton';
import { SessionIconButton } from '../../icon';

export const SelectionOverlay = () => {
  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const selectedConversationKey = useSelectedConversationKey();
  const isPublic = useSelectedIsPublic();
  const dispatch = useDispatch();

  const { i18n } = window;

  function onCloseOverlay() {
    dispatch(resetSelectedMessageIds());
  }

  function onDeleteSelectedMessages() {
    if (selectedConversationKey) {
      void deleteMessagesById(selectedMessageIds, selectedConversationKey);
    }
  }
  function onDeleteSelectedMessagesForEveryone() {
    if (selectedConversationKey) {
      void deleteMessagesByIdForEveryone(selectedMessageIds, selectedConversationKey);
    }
  }

  const isOnlyServerDeletable = isPublic;
  const deleteMessageButtonText = i18n('delete');
  const deleteForEveryoneMessageButtonText = i18n('deleteForEveryone');

  return (
    <div className="message-selection-overlay">
      <div className="close-button">
        <SessionIconButton iconType="exit" iconSize="medium" onClick={onCloseOverlay} />
      </div>

      <div className="button-group">
        {!isOnlyServerDeletable && (
          <SessionButton
            buttonColor={SessionButtonColor.Danger}
            buttonShape={SessionButtonShape.Square}
            buttonType={SessionButtonType.Solid}
            text={deleteMessageButtonText}
            onClick={onDeleteSelectedMessages}
          />
        )}
        <SessionButton
          buttonColor={SessionButtonColor.Danger}
          buttonShape={SessionButtonShape.Square}
          buttonType={SessionButtonType.Solid}
          text={deleteForEveryoneMessageButtonText}
          onClick={onDeleteSelectedMessagesForEveryone}
        />
      </div>
    </div>
  );
};
