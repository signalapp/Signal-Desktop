// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { MutableRefObject } from 'react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import type { ConversationType } from '../../../state/ducks/conversations.preload.js';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges.preload.js';
import type { LocalizerType } from '../../../types/I18N.std.js';
import type { ThemeType } from '../../../types/Util.std.js';
import { Input } from '../../Input.dom.js';
import { ConfirmationDialog } from '../../ConfirmationDialog.dom.js';
import type { ChatFolderSelection } from '../PreferencesSelectChatsDialog.dom.js';
import { SettingsControl, SettingsRow } from '../../PreferencesUtil.dom.js';
import { PreferencesSelectChatsDialog } from '../PreferencesSelectChatsDialog.dom.js';
import { Avatar, AvatarSize } from '../../Avatar.dom.js';
import { PreferencesContent } from '../../Preferences.dom.js';
import {
  CHAT_FOLDER_NAME_MAX_CHAR_LENGTH,
  ChatFolderParamsSchema,
  isSameChatFolderParams,
  validateChatFolderParams,
} from '../../../types/ChatFolder.std.js';
import type {
  ChatFolderId,
  ChatFolderParams,
} from '../../../types/ChatFolder.std.js';
import type { GetConversationByIdType } from '../../../state/selectors/conversations.dom.js';
import { strictAssert } from '../../../util/assert.std.js';
import { parseStrict } from '../../../util/schemas.std.js';
import { BeforeNavigateResponse } from '../../../services/BeforeNavigate.std.js';
import { NavTab, SettingsPage } from '../../../types/Nav.std.js';
import type { Location } from '../../../types/Nav.std.js';
import { useNavBlocker } from '../../../hooks/useNavBlocker.std.js';
import { DeleteChatFolderDialog } from './DeleteChatFolderDialog.dom.js';
import { UserText } from '../../UserText.dom.js';
import { AxoSwitch } from '../../../axo/AxoSwitch.dom.js';
import { FunEmojiPickerButton } from '../../fun/FunButton.dom.js';
import { FunEmojiPicker } from '../../fun/FunEmojiPicker.dom.js';
import type { FunEmojiSelection } from '../../fun/panels/FunPanelEmojis.dom.js';
import { getEmojiVariantByKey } from '../../fun/data/emojis.std.js';
import {
  ItemAvatar,
  ItemBody,
  itemButtonClassName,
  itemClassName,
  ItemContent,
  ItemTitle,
} from './PreferencesChatFolderItems.dom.js';
import { AxoButton } from '../../../axo/AxoButton.dom.js';

export type PreferencesEditChatFolderPageProps = Readonly<{
  i18n: LocalizerType;
  previousLocation: Location | null;
  existingChatFolderId: ChatFolderId | null;
  initChatFolderParams: ChatFolderParams;
  changeLocation: (location: Location) => void;
  conversations: ReadonlyArray<ConversationType>;
  preferredBadgeSelector: PreferredBadgeSelectorType;
  theme: ThemeType;
  settingsPaneRef: MutableRefObject<HTMLDivElement | null>;
  conversationSelector: GetConversationByIdType;
  onDeleteChatFolder: (chatFolderId: ChatFolderId) => void;
  onCreateChatFolder: (
    chatFolderParams: ChatFolderParams,
    showToastOnSuccess: boolean
  ) => void;
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

  const inputRef = useRef<HTMLInputElement>(null);

  const [chatFolderParams, setChatFolderParams] =
    useState(initChatFolderParams);

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
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

  const handleSelectEmoji = useCallback((emojiSelection: FunEmojiSelection) => {
    setChatFolderParams(prevParams => {
      strictAssert(inputRef.current, 'Missing input ref');
      const input = inputRef.current;
      const { selectionStart, selectionEnd } = input;

      const variant = getEmojiVariantByKey(emojiSelection.variantKey);
      const emoji = variant.value;

      let newName: string;
      if (selectionStart == null || selectionEnd == null) {
        newName = `${prevParams.name}${emoji}`;
      } else {
        const before = prevParams.name.slice(0, selectionStart);
        const after = prevParams.name.slice(selectionEnd);
        newName = `${before}${emoji}${after}`;
      }

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
    changeLocation(
      previousLocation ?? {
        tab: NavTab.Settings,
        details: {
          page: SettingsPage.ChatFolders,
          previousLocation: null,
        },
      }
    );
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
      onCreateChatFolder(normalizedChatFolderParams, false);
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
                ref={inputRef}
                i18n={i18n}
                value={chatFolderParams.name}
                onChange={handleNameChange}
                placeholder={i18n(
                  'icu:Preferences__EditChatFolderPage__FolderNameField__Placeholder'
                )}
                maxLengthCount={CHAT_FOLDER_NAME_MAX_CHAR_LENGTH}
                whenToShowRemainingCount={CHAT_FOLDER_NAME_MAX_CHAR_LENGTH - 10}
              >
                <FunEmojiPicker
                  open={emojiPickerOpen}
                  onOpenChange={setEmojiPickerOpen}
                  onSelectEmoji={handleSelectEmoji}
                  closeOnSelect
                >
                  <FunEmojiPickerButton i18n={i18n} />
                </FunEmojiPicker>
              </Input>
            </div>
          </SettingsRow>
          <SettingsRow
            title={i18n(
              'icu:Preferences__EditChatFolderPage__IncludedChatsSection__Title'
            )}
          >
            <button
              type="button"
              className={classNames(itemClassName, itemButtonClassName)}
              onClick={handleSelectInclusions}
            >
              <ItemContent>
                <ItemAvatar kind="Add" />
                <ItemBody>
                  <ItemTitle>
                    {i18n(
                      'icu:Preferences__EditChatFolderPage__IncludedChatsSection__AddChatsButton'
                    )}
                  </ItemTitle>
                </ItemBody>
              </ItemContent>
            </button>
            <ul className="Preferences__ChatFolders__ChatSelection__List">
              {chatFolderParams.includeAllIndividualChats && (
                <li className={itemClassName}>
                  <ItemContent>
                    <ItemAvatar kind="DirectChats" />
                    <ItemBody>
                      <ItemTitle>
                        {i18n(
                          'icu:Preferences__EditChatFolderPage__IncludedChatsSection__DirectChats'
                        )}
                      </ItemTitle>
                    </ItemBody>
                  </ItemContent>
                </li>
              )}
              {chatFolderParams.includeAllGroupChats && (
                <li className={itemClassName}>
                  <ItemContent>
                    <ItemAvatar kind="GroupChats" />
                    <ItemBody>
                      <ItemTitle>
                        {i18n(
                          'icu:Preferences__EditChatFolderPage__IncludedChatsSection__GroupChats'
                        )}
                      </ItemTitle>
                    </ItemBody>
                  </ItemContent>
                </li>
              )}
              {chatFolderParams.includedConversationIds.map(conversationId => {
                const conversation = conversationSelector(conversationId);
                return (
                  <li key={conversationId} className={itemClassName}>
                    <ItemContent>
                      <Avatar
                        i18n={i18n}
                        conversationType={conversation.type}
                        size={AvatarSize.THIRTY_SIX}
                        badge={undefined}
                        {...conversation}
                      />
                      <ItemBody>
                        <ItemTitle>
                          <UserText text={conversation.title} />
                        </ItemTitle>
                      </ItemBody>
                    </ItemContent>
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
              className={classNames(itemClassName, itemButtonClassName)}
              onClick={handleSelectExclusions}
            >
              <ItemContent>
                <ItemAvatar kind="Add" />
                <ItemBody>
                  <ItemTitle>
                    {i18n(
                      'icu:Preferences__EditChatFolderPage__ExceptionsSection__ExcludeChatsButton'
                    )}
                  </ItemTitle>
                </ItemBody>
              </ItemContent>
            </button>
            <ul className="Preferences__ChatFolders__ChatSelection__List">
              {chatFolderParams.excludedConversationIds.map(conversationId => {
                const conversation = conversationSelector(conversationId);
                return (
                  <li key={conversationId} className={itemClassName}>
                    <ItemContent>
                      <Avatar
                        i18n={i18n}
                        conversationType={conversation.type}
                        size={AvatarSize.THIRTY_SIX}
                        badge={undefined}
                        {...conversation}
                      />
                      <ItemBody>
                        <ItemTitle>
                          <UserText text={conversation.title} />
                        </ItemTitle>
                      </ItemBody>
                    </ItemContent>
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
            <SettingsControl
              left={i18n(
                'icu:Preferences__EditChatFolderPage__OnlyShowUnreadChatsCheckbox__Label'
              )}
              description={i18n(
                'icu:Preferences__EditChatFolderPage__OnlyShowUnreadChatsCheckbox__Description'
              )}
              right={
                <AxoSwitch.Root
                  checked={chatFolderParams.showOnlyUnread}
                  onCheckedChange={handleShowOnlyUnreadChange}
                />
              }
            />
            <SettingsControl
              left={i18n(
                'icu:Preferences__EditChatFolderPage__IncludeMutedChatsCheckbox__Label'
              )}
              right={
                <AxoSwitch.Root
                  checked={chatFolderParams.showMutedChats}
                  onCheckedChange={handleShowMutedChatsChange}
                />
              }
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
          <AxoButton.Root
            size="large"
            variant="secondary"
            onClick={handleDiscardAndBack}
          >
            {i18n('icu:Preferences__EditChatFolderPage__CancelButton')}
          </AxoButton.Root>
          <AxoButton.Root
            size="large"
            variant="primary"
            onClick={handleSaveChangesAndBack}
            disabled={!(isChanged && isValid)}
          >
            {i18n('icu:Preferences__EditChatFolderPage__SaveButton')}
          </AxoButton.Root>
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
