import FocusTrap from 'focus-trap-react';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import useKey from 'react-use/lib/useKey';

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

  function onCloseOverlay() {
    dispatch(resetSelectedMessageIds());
  }
  /**
   * This is a duplicate with the onKeyDown of SessionConversation.
   * At some point we'll make a global handler to deal with the key presses
   * and handle them depending on what is visible, but that's not part of this PR
   */
  useKey(
    shouldProcess => {
      return (
        shouldProcess.code === 'Escape' ||
        shouldProcess.code === 'Backspace' ||
        shouldProcess.code === 'Delete'
      );
    },
    event => {
      const selectionMode = !!selectedMessageIds.length;
      switch (event.key) {
        case 'Escape':
          if (selectionMode) {
            onCloseOverlay();
          }
          return true;
        case 'Backspace':
        case 'Delete':
          if (selectionMode && selectedConversationKey) {
            void deleteMessagesForX(selectedMessageIds, selectedConversationKey, isPublic);
          }
          return true;
        default:
      }
      return false;
    }
  );

  const isOnlyServerDeletable = isPublic;

  const classNameAndId = 'message-selection-overlay';

  return (
    <FocusTrap focusTrapOptions={{ fallbackFocus: `#${classNameAndId}`, allowOutsideClick: true }}>
      <div className={classNameAndId} id={classNameAndId}>
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
    </FocusTrap>
  );
};
