// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { MutableRefObject } from 'react';
import React, { useCallback, useMemo, useRef, useState } from 'react';

import { Input } from '../../Input.js';
import { Button, ButtonVariant } from '../../Button.js';
import { ConfirmationDialog } from '../../ConfirmationDialog.js';
import { PreferencesSelectChatsDialog } from '../PreferencesSelectChatsDialog.js';
import { SettingsRow } from '../../PreferencesUtil.js';
import { Checkbox } from '../../Checkbox.js';
import { Avatar, AvatarSize } from '../../Avatar.js';
import { PreferencesContent } from '../../Preferences.js';
import {
  CHAT_FOLDER_NAME_MAX_CHAR_LENGTH,
  ChatFolderParamsSchema,
  isSameChatFolderParams,
  validateChatFolderParams,
} from '../../../types/ChatFolder.js';
import { strictAssert } from '../../../util/assert.js';
import { parseStrict } from '../../../util/schemas.js';
import { BeforeNavigateResponse } from '../../../services/BeforeNavigate.js';
import { useNavBlocker } from '../../../hooks/useNavBlocker.js';
import { DeleteChatFolderDialog } from './DeleteChatFolderDialog.js';

import type { ConversationType } from '../../../state/ducks/conversations.js';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges.js';
import type { LocalizerType } from '../../../types/I18N.js';
import type { ThemeType } from '../../../types/Util.js';
import type { ChatFolderSelection } from '../PreferencesSelectChatsDialog.js';
import type {
  ChatFolderId,
  ChatFolderParams,
} from '../../../types/ChatFolder.js';
import type { GetConversationByIdType } from '../../../state/selectors/conversations.js';
import type { Location } from '../../../types/Nav.js';

export type PreferencesEditChatFolderPageProps = Readonly<{
  i18n: LocalizerType;
  previousLocation: Location;
  existingChatFolderId: ChatFolderId | null;
  initChatFolderParams: ChatFolderParams;
  changeLocation: (location: Location) => void;
  conversations: ReadonlyArray<ConversationType>;
  preferredBadgeSelector: PreferredBadgeSelectorType;
  theme: ThemeType;
  settingsPaneRef: MutableRefObject<HTMLDivElement | null>;
  conversationSelector: GetConversationByIdType;
  onDeleteChatFolder: (chatFolderId: ChatFolderId) => void;
  onCreateChatFolder: (chatFolderParams: ChatFolderParams) => void;
  onUpdateChatFolder: (
    chatFolderId: ChatFolderId,
    chatFolderParams: ChatFolderParams
  ) => void;
}>;

export function PreferencesEditChatFolderPage(
  props: PreferencesEditChatFolderPageProps
): JSX.Element {
  const {
    i18n,
    previousLocation,
    initChatFolderParams,
    existingChatFolderId,
    onCreateChatFolder,
    onUpdateChatFolder,
    onDeleteChatFolder,
    changeLocation,
    conversationSelector,
  } = props;

  const [chatFolderParams, setChatFolderParams] =
    useState(initChatFolderParams);

  const [showInclusionsDialog, setShowInclusionsDialog] = useState(false);
  const [showExclusionsDialog, setShowExclusionsDialog] = useState(false);
  const [showDeleteFolderDialog, setShowDeleteFolderDialog] = useState(false);

  const normalizedChatFolderParams = useMemo(() => {
    return parseStrict(ChatFolderParamsSchema, chatFolderParams);
  }, [chatFolderParams]);

  const isChanged = useMemo(() => {
    return !isSameChatFolderParams(
      initChatFolderParams,
      normalizedChatFolderParams
    );
  }, [initChatFolderParams, normalizedChatFolderParams]);

  const didSaveOrDiscardChangesRef = useRef(false);

  const blocker = useNavBlocker('PreferencesEditChatFoldersPage', () => {
    return isChanged && !didSaveOrDiscardChangesRef.current;
  });

  const isValid = useMemo(() => {
    return validateChatFolderParams(normalizedChatFolderParams);
  }, [normalizedChatFolderParams]);

  const handleNameChange = useCallback((newName: string) => {
    setChatFolderParams(prevParams => {
      return { ...prevParams, name: newName };
    });
  }, []);

  const handleShowOnlyUnreadChange = useCallback((newValue: boolean) => {
    setChatFolderParams(prevParams => {
      return { ...prevParams, showOnlyUnread: newValue };
    });
  }, []);

  const handleShowMutedChatsChange = useCallback((newValue: boolean) => {
    setChatFolderParams(prevParams => {
      return { ...prevParams, showMutedChats: newValue };
    });
  }, []);

  const handleBack = useCallback(() => {
    changeLocation(previousLocation);
  }, [changeLocation, previousLocation]);

  const handleDiscardAndBack = useCallback(() => {
    didSaveOrDiscardChangesRef.current = true;
    handleBack();
  }, [handleBack]);

  const handleSaveChanges = useCallback(() => {
    strictAssert(isChanged, 'tried saving when unchanged');
    strictAssert(isValid, 'tried saving when invalid');

    if (existingChatFolderId != null) {
      onUpdateChatFolder(existingChatFolderId, normalizedChatFolderParams);
    } else {
      onCreateChatFolder(normalizedChatFolderParams);
    }

    didSaveOrDiscardChangesRef.current = true;
  }, [
    existingChatFolderId,
    isChanged,
    isValid,
    normalizedChatFolderParams,
    onCreateChatFolder,
    onUpdateChatFolder,
  ]);

  const handleSaveChangesAndBack = useCallback(() => {
    handleSaveChanges();
    handleBack();
  }, [handleSaveChanges, handleBack]);

  const handleBlockerCancelNavigation = useCallback(() => {
    blocker.respond?.(BeforeNavigateResponse.CancelNavigation);
  }, [blocker]);

  const handleBlockerSaveChanges = useCallback(() => {
    handleSaveChanges();
    blocker.respond?.(BeforeNavigateResponse.WaitedForUser);
  }, [handleSaveChanges, blocker]);

  const handleBlockerDiscardChanges = useCallback(() => {
    blocker.respond?.(BeforeNavigateResponse.WaitedForUser);
  }, [blocker]);

  const handleDeleteInit = useCallback(() => {
    setShowDeleteFolderDialog(true);
  }, []);
  const handleDeleteConfirm = useCallback(() => {
    strictAssert(existingChatFolderId, 'Missing existing chat folder id');
    onDeleteChatFolder(existingChatFolderId);
    setShowDeleteFolderDialog(false);
    handleBack();
  }, [existingChatFolderId, onDeleteChatFolder, handleBack]);
  const handleDeleteClose = useCallback(() => {
    setShowDeleteFolderDialog(false);
  }, []);
  const handleSelectInclusions = useCallback(() => {
    setShowInclusionsDialog(true);
  }, []);
  const handleSelectExclusions = useCallback(() => {
    setShowExclusionsDialog(true);
  }, []);

  const handleCloseInclusions = useCallback(
    (selection: ChatFolderSelection) => {
      setChatFolderParams(prevParams => {
        return {
          ...prevParams,
          includeAllIndividualChats: selection.selectAllIndividualChats,
          includeAllGroupChats: selection.selectAllGroupChats,
          includedConversationIds: selection.selectedRecipientIds,
        };
      });
      setShowInclusionsDialog(false);
    },
    []
  );

  const handleCloseExclusions = useCallback(
    (selection: ChatFolderSelection) => {
      setChatFolderParams(prevParams => {
        return {
          ...prevParams,
          includeAllIndividualChats: !selection.selectAllIndividualChats,
          includeAllGroupChats: !selection.selectAllGroupChats,
          excludedConversationIds: selection.selectedRecipientIds,
        };
      });
      setShowExclusionsDialog(false);
    },
    []
  );

  return (
    <PreferencesContent
      backButton={
        <button
          aria-label={i18n('icu:goBack')}
          className="Preferences__back-icon"
          onClick={handleBack}
          type="button"
        />
      }
      contents={
        <>
          <SettingsRow
            title={i18n(
              'icu:Preferences__EditChatFolderPage__FolderNameField__Label'
            )}
          >
            <div
              className="Preferences__padding"
              data-testid="EditChatFolderName"
            >
              <Input
                i18n={i18n}
                value={chatFolderParams.name}
                onChange={handleNameChange}
                placeholder={i18n(
                  'icu:Preferences__EditChatFolderPage__FolderNameField__Placeholder'
                )}
                maxLengthCount={CHAT_FOLDER_NAME_MAX_CHAR_LENGTH}
                whenToShowRemainingCount={CHAT_FOLDER_NAME_MAX_CHAR_LENGTH - 10}
              />
            </div>
          </SettingsRow>
          <SettingsRow
            title={i18n(
              'icu:Preferences__EditChatFolderPage__IncludedChatsSection__Title'
            )}
          >
            <button
              type="button"
              className="Preferences__ChatFolders__ChatSelection__Item Preferences__ChatFolders__ChatSelection__Item--Button"
              onClick={handleSelectInclusions}
            >
              <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--Add" />
              <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
                {i18n(
                  'icu:Preferences__EditChatFolderPage__IncludedChatsSection__AddChatsButton'
                )}
              </span>
            </button>
            <ul className="Preferences__ChatFolders__ChatSelection__List">
              {chatFolderParams.includeAllIndividualChats && (
                <li className="Preferences__ChatFolders__ChatSelection__Item">
                  <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--DirectChats" />
                  <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
                    {i18n(
                      'icu:Preferences__EditChatFolderPage__IncludedChatsSection__DirectChats'
                    )}
                  </span>
                </li>
              )}
              {chatFolderParams.includeAllGroupChats && (
                <li className="Preferences__ChatFolders__ChatSelection__Item">
                  <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--GroupChats" />
                  <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
                    {i18n(
                      'icu:Preferences__EditChatFolderPage__IncludedChatsSection__GroupChats'
                    )}
                  </span>
                </li>
              )}
              {chatFolderParams.includedConversationIds.map(conversationId => {
                const conversation = conversationSelector(conversationId);
                return (
                  <li
                    key={conversationId}
                    className="Preferences__ChatFolders__ChatSelection__Item"
                  >
                    <Avatar
                      i18n={i18n}
                      conversationType={conversation.type}
                      size={AvatarSize.THIRTY_SIX}
                      badge={undefined}
                      {...conversation}
                    />
                    <span className="Preferences__ChatFolders__ChatList__ItemTitle">
                      {conversation.title}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="Preferences__padding">
              <p className="Preferences__description">
                {i18n(
                  'icu:Preferences__EditChatFolderPage__IncludedChatsSection__Help'
                )}
              </p>
            </div>
          </SettingsRow>
          <SettingsRow
            title={i18n(
              'icu:Preferences__EditChatFolderPage__ExceptionsSection__Title'
            )}
          >
            <button
              type="button"
              className="Preferences__ChatFolders__ChatSelection__Item Preferences__ChatFolders__ChatSelection__Item--Button"
              onClick={handleSelectExclusions}
            >
              <span className="Preferences__ChatFolders__ChatSelection__ItemAvatar Preferences__ChatFolders__ChatSelection__ItemAvatar--Add" />
              <span className="Preferences__ChatFolders__ChatSelection__ItemTitle">
                {i18n(
                  'icu:Preferences__EditChatFolderPage__ExceptionsSection__ExcludeChatsButton'
                )}
              </span>
            </button>
            <ul className="Preferences__ChatFolders__ChatSelection__List">
              {chatFolderParams.excludedConversationIds.map(conversationId => {
                const conversation = conversationSelector(conversationId);
                return (
                  <li
                    key={conversationId}
                    className="Preferences__ChatFolders__ChatSelection__Item"
                  >
                    <Avatar
                      i18n={i18n}
                      conversationType={conversation.type}
                      size={AvatarSize.THIRTY_SIX}
                      badge={undefined}
                      {...conversation}
                    />
                    <span className="Preferences__ChatFolders__ChatList__ItemTitle">
                      {conversation.title}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="Preferences__padding">
              <p className="Preferences__description">
                {i18n(
                  'icu:Preferences__EditChatFolderPage__ExceptionsSection__Help'
                )}
              </p>
            </div>
          </SettingsRow>
          <SettingsRow>
            <Checkbox
              checked={chatFolderParams.showOnlyUnread}
              label={i18n(
                'icu:Preferences__EditChatFolderPage__OnlyShowUnreadChatsCheckbox__Label'
              )}
              description={i18n(
                'icu:Preferences__EditChatFolderPage__OnlyShowUnreadChatsCheckbox__Description'
              )}
              moduleClassName="Preferences__checkbox"
              name="showOnlyUnread"
              onChange={handleShowOnlyUnreadChange}
            />
            <Checkbox
              checked={chatFolderParams.showMutedChats}
              label={i18n(
                'icu:Preferences__EditChatFolderPage__IncludeMutedChatsCheckbox__Label'
              )}
              moduleClassName="Preferences__checkbox"
              name="showMutedChats"
              onChange={handleShowMutedChatsChange}
            />
          </SettingsRow>
          {props.existingChatFolderId != null && (
            <SettingsRow>
              <div className="Preferences__padding">
                <button
                  type="button"
                  onClick={handleDeleteInit}
                  className="Preferences__ChatFolders__ChatList__DeleteButton"
                >
                  {i18n(
                    'icu:Preferences__EditChatFolderPage__DeleteFolderButton'
                  )}
                </button>
              </div>
            </SettingsRow>
          )}
          {showInclusionsDialog && (
            <PreferencesSelectChatsDialog
              i18n={i18n}
              title={i18n(
                'icu:Preferences__EditChatFolderPage__SelectChatsDialog--IncludedChats__Title'
              )}
              onClose={handleCloseInclusions}
              conversations={props.conversations}
              preferredBadgeSelector={props.preferredBadgeSelector}
              theme={props.theme}
              conversationSelector={props.conversationSelector}
              initialSelection={{
                selectAllIndividualChats:
                  chatFolderParams.includeAllIndividualChats,
                selectAllGroupChats: chatFolderParams.includeAllGroupChats,
                selectedRecipientIds: chatFolderParams.includedConversationIds,
              }}
              showChatTypes
            />
          )}
          {showExclusionsDialog && (
            <PreferencesSelectChatsDialog
              i18n={i18n}
              title={i18n(
                'icu:Preferences__EditChatFolderPage__SelectChatsDialog--ExcludedChats__Title'
              )}
              onClose={handleCloseExclusions}
              conversations={props.conversations}
              preferredBadgeSelector={props.preferredBadgeSelector}
              theme={props.theme}
              conversationSelector={props.conversationSelector}
              initialSelection={{
                selectAllIndividualChats:
                  !chatFolderParams.includeAllIndividualChats,
                selectAllGroupChats: !chatFolderParams.includeAllGroupChats,
                selectedRecipientIds: chatFolderParams.excludedConversationIds,
              }}
              showChatTypes={false}
            />
          )}
          {showDeleteFolderDialog && (
            <DeleteChatFolderDialog
              i18n={i18n}
              title={i18n(
                'icu:Preferences__EditChatFolderPage__DeleteChatFolderDialog__Title'
              )}
              description={i18n(
                'icu:Preferences__EditChatFolderPage__DeleteChatFolderDialog__Description'
              )}
              cancelText={i18n(
                'icu:Preferences__EditChatFolderPage__DeleteChatFolderDialog__CancelButton'
              )}
              deleteText={i18n(
                'icu:Preferences__EditChatFolderPage__DeleteChatFolderDialog__DeleteButton'
              )}
              onConfirm={handleDeleteConfirm}
              onClose={handleDeleteClose}
            />
          )}
          {blocker.state === 'blocked' && (
            <SaveChangesFolderDialog
              i18n={i18n}
              onSave={handleBlockerSaveChanges}
              onDiscard={handleBlockerDiscardChanges}
              onClose={handleBlockerCancelNavigation}
            />
          )}
        </>
      }
      contentsRef={props.settingsPaneRef}
      title={i18n('icu:Preferences__EditChatFolderPage__Title')}
      actions={
        <>
          <Button
            variant={ButtonVariant.Secondary}
            onClick={handleDiscardAndBack}
          >
            {i18n('icu:Preferences__EditChatFolderPage__CancelButton')}
          </Button>
          <Button
            variant={ButtonVariant.Primary}
            onClick={handleSaveChangesAndBack}
            disabled={!(isChanged && isValid)}
          >
            {i18n('icu:Preferences__EditChatFolderPage__SaveButton')}
          </Button>
        </>
      }
    />
  );
}

function SaveChangesFolderDialog(props: {
  i18n: LocalizerType;
  onSave: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const { i18n } = props;

  return (
    <ConfirmationDialog
      i18n={i18n}
      dialogName="Preferences__EditChatFolderPage__SaveChangesFolderDialog"
      title={i18n(
        'icu:Preferences__EditChatFolderPage__SaveChangesFolderDialog__Title'
      )}
      cancelText={i18n(
        'icu:Preferences__EditChatFolderPage__SaveChangesFolderDialog__DiscardButton'
      )}
      actions={[
        {
          text: i18n(
            'icu:Preferences__EditChatFolderPage__SaveChangesFolderDialog__SaveButton'
          ),
          style: 'affirmative',
          action: props.onSave,
        },
      ]}
      onCancel={props.onDiscard}
      onClose={props.onClose}
    >
      {i18n(
        'icu:Preferences__EditChatFolderPage__SaveChangesFolderDialog__Description'
      )}
    </ConfirmationDialog>
  );
}
