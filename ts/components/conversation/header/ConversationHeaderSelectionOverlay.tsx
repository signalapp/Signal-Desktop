import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useKey } from 'react-use';
import {
  deleteMessagesById,
  deleteMessagesByIdForEveryone,
  deleteMessagesForX,
} from '../../../interactions/conversations/unsendingInteractions';
import { resetSelectedMessageIds } from '../../../state/ducks/conversations';
import { getSelectedMessageIds } from '../../../state/selectors/conversations';
import {
  useSelectedConversationKey,
  useSelectedIsPublic,
} from '../../../state/selectors/selectedConversation';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonShape,
  SessionButtonType,
} from '../../basic/SessionButton';
import { SessionIconButton } from '../../icon';

function onDeleteSelectedMessagesForEveryone(
  selectedConversationKey: string,
  selectedMessageIds: Array<string>
) {
  if (selectedConversationKey) {
    void deleteMessagesByIdForEveryone(selectedMessageIds, selectedConversationKey);
  }
}

export const SelectionOverlay = () => {
  const selectedMessageIds = useSelector(getSelectedMessageIds);
  const selectedConversationKey = useSelectedConversationKey();
  const isPublic = useSelectedIsPublic();
  const dispatch = useDispatch();

  useKey('Delete', event => {
    const selectionMode = !!selectedMessageIds.length;

    switch (event.key) {
      case 'Escape':
        if (selectionMode) {
          dispatch(resetSelectedMessageIds());
        }
        break;
      case 'Backspace':
      case 'Delete':
        if (selectionMode && selectedConversationKey) {
          void deleteMessagesForX(selectedMessageIds, selectedConversationKey, isPublic);
        }
        break;
      default:
    }
  });

  function onCloseOverlay() {
    dispatch(resetSelectedMessageIds());
  }

  const isOnlyServerDeletable = isPublic;

  return (
    <div className="message-selection-overlay">
      <div className="close-button">
        <SessionIconButton iconType="exit" iconSize="medium" onClick={onCloseOverlay} />
      </div>

      <div className="button-group">
        <SessionButton
          buttonColor={SessionButtonColor.Danger}
          buttonShape={SessionButtonShape.Square}
          buttonType={SessionButtonType.Solid}
          text={window.i18n('delete')}
          onClick={() => {
            if (selectedConversationKey) {
              if (isOnlyServerDeletable) {
                void onDeleteSelectedMessagesForEveryone(
                  selectedConversationKey,
                  selectedMessageIds
                );
              } else {
                void deleteMessagesById(selectedMessageIds, selectedConversationKey);
              }
            }
          }}
        />
      </div>
    </div>
  );
};
