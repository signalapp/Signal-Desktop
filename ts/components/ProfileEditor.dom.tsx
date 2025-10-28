// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSpring, animated } from '@react-spring/web';

import type { MutableRefObject } from 'react';

import { AvatarColors } from '../types/Colors.std.js';
import { AvatarEditor } from './AvatarEditor.dom.js';
import { AvatarPreview } from './AvatarPreview.dom.js';
import { ButtonVariant } from './Button.dom.js';
import { Input } from './Input.dom.js';
import { PanelRow } from './conversation/conversation-details/PanelRow.dom.js';
import { UsernameEditState } from '../state/ducks/usernameEnums.std.js';
import { ToastType } from '../types/Toast.dom.js';
import { assertDev } from '../util/assert.std.js';
import { missingCaseError } from '../util/missingCaseError.std.js';
import { ConfirmationDialog } from './ConfirmationDialog.dom.js';
import { ContextMenu } from './ContextMenu.dom.js';
import { UsernameLinkEditor } from './UsernameLinkEditor.dom.js';
import {
  ConversationDetailsIcon,
  IconType,
} from './conversation/conversation-details/ConversationDetailsIcon.dom.js';
import { isWhitespace, trim } from '../util/whitespaceStringUtil.std.js';
import { UserText } from './UserText.dom.js';
import { Tooltip, TooltipPlacement } from './Tooltip.dom.js';
import { offsetDistanceModifier } from '../util/popperUtil.std.js';
import { useReducedMotion } from '../hooks/useReducedMotion.dom.js';
import { FunStaticEmoji } from './fun/FunEmoji.dom.js';
import {
  EMOJI_PARENT_KEY_CONSTANTS,
  EmojiSkinTone,
  getEmojiVariantByKey,
  getEmojiVariantByParentKeyAndSkinTone,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from './fun/data/emojis.std.js';
import { FunEmojiPicker } from './fun/FunEmojiPicker.dom.js';
import { FunEmojiPickerButton } from './fun/FunButton.dom.js';
import { useFunEmojiLocalizer } from './fun/useFunEmojiLocalizer.dom.js';
import { PreferencesContent } from './Preferences.dom.js';
import { ProfileEditorPage } from '../types/Nav.std.js';

import type { AvatarColorType } from '../types/Colors.std.js';
import type {
  AvatarDataType,
  AvatarUpdateOptionsType,
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../types/Avatar.std.js';
import type { LocalizerType } from '../types/Util.std.js';
import type {
  ConversationType,
  ProfileDataType,
  SaveAttachmentActionCreatorType,
} from '../state/ducks/conversations.preload.js';
import type { UsernameLinkState } from '../state/ducks/usernameEnums.std.js';
import type { ShowToastAction } from '../state/ducks/toast.preload.js';
import type { EmojiParentKey, EmojiVariantKey } from './fun/data/emojis.std.js';
import type { FunEmojiSelection } from './fun/panels/FunPanelEmojis.dom.js';
import { useConfirmDiscard } from '../hooks/useConfirmDiscard.dom.js';
import { AxoButton } from '../axo/AxoButton.dom.js';

type ProfileEditorData = {
  firstName: string;
} & Pick<ConversationType, 'aboutEmoji' | 'aboutText' | 'familyName'>;

type PropsExternalType = {
  onProfileChanged: (
    profileData: ProfileDataType,
    avatarUpdateOptions: AvatarUpdateOptionsType
  ) => unknown;
  renderUsernameEditor: (props: { onClose: () => void }) => JSX.Element;
};

export type PropsDataType = {
  aboutEmoji?: string;
  aboutText?: string;
  color?: AvatarColorType;
  contentsRef: MutableRefObject<HTMLDivElement | null>;
  conversationId: string;
  emojiSkinToneDefault: EmojiSkinTone | null;
  familyName?: string;
  firstName: string;
  hasCompletedUsernameLinkOnboarding: boolean;
  i18n: LocalizerType;
  editState: ProfileEditorPage;
  profileAvatarUrl?: string;
  userAvatarData: ReadonlyArray<AvatarDataType>;
  username?: string;
  usernameCorrupted: boolean;
  usernameEditState: UsernameEditState;
  usernameLink?: string;
  usernameLinkColor?: number;
  usernameLinkCorrupted: boolean;
  usernameLinkState: UsernameLinkState;
};

type PropsActionType = {
  deleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  markCompletedUsernameLinkOnboarding: () => void;
  replaceAvatar: ReplaceAvatarActionType;
  saveAttachment: SaveAttachmentActionCreatorType;
  saveAvatarToDisk: SaveAvatarToDiskActionType;
  setUsernameEditState: (editState: UsernameEditState) => void;
  setUsernameLinkColor: (color: number) => void;
  resetUsernameLink: () => void;
  deleteUsername: () => void;
  setEditState: (editState: ProfileEditorPage) => void;
  showToast: ShowToastAction;
  openUsernameReservationModal: () => void;
};

export type PropsType = PropsDataType & PropsActionType & PropsExternalType;

type DefaultBio = {
  i18nLabel: string;
  emojiParentKey: EmojiParentKey;
};

function getDefaultBios(i18n: LocalizerType): Array<DefaultBio> {
  return [
    {
      i18nLabel: i18n('icu:Bio--speak-freely'),
      emojiParentKey: EMOJI_PARENT_KEY_CONSTANTS.WAVING_HAND,
    },
    {
      i18nLabel: i18n('icu:Bio--encrypted'),
      emojiParentKey: EMOJI_PARENT_KEY_CONSTANTS.ZIPPER_MOUTH_FACE,
    },
    {
      i18nLabel: i18n('icu:Bio--free-to-chat'),
      emojiParentKey: EMOJI_PARENT_KEY_CONSTANTS.THUMBS_UP,
    },
    {
      i18nLabel: i18n('icu:Bio--coffee-lover'),
      emojiParentKey: EMOJI_PARENT_KEY_CONSTANTS.HOT_BEVERAGE,
    },
    {
      i18nLabel: i18n('icu:Bio--taking-break'),
      emojiParentKey: EMOJI_PARENT_KEY_CONSTANTS.MOBILE_PHONE_OFF,
    },
  ];
}

function BioEmoji(props: { emoji: EmojiVariantKey }) {
  const emojiLocalizer = useFunEmojiLocalizer();
  const emojiVariant = getEmojiVariantByKey(props.emoji);
  return (
    <FunStaticEmoji
      role="img"
      aria-label={emojiLocalizer.getLocaleShortName(props.emoji)}
      emoji={emojiVariant}
      size={24}
    />
  );
}

export function ProfileEditor({
  aboutEmoji,
  aboutText,
  color,
  conversationId,
  contentsRef,
  deleteAvatarFromDisk,
  deleteUsername,
  familyName,
  firstName,
  hasCompletedUsernameLinkOnboarding,
  i18n,
  editState,
  markCompletedUsernameLinkOnboarding,
  onProfileChanged,
  openUsernameReservationModal,
  profileAvatarUrl,
  renderUsernameEditor,
  replaceAvatar,
  resetUsernameLink,
  saveAttachment,
  saveAvatarToDisk,
  setEditState,
  setUsernameEditState,
  setUsernameLinkColor,
  showToast,
  emojiSkinToneDefault,
  userAvatarData,
  username,
  usernameCorrupted,
  usernameEditState,
  usernameLinkState,
  usernameLinkColor,
  usernameLink,
  usernameLinkCorrupted,
}: PropsType): JSX.Element {
  const focusInputRef = useRef<HTMLInputElement | null>(null);
  const tryClose = useRef<() => void | undefined>();
  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard({
    i18n,
    name: 'ProfileEditor',
    tryClose,
  });

  const TITLES_BY_EDIT_STATE: Record<ProfileEditorPage, string | undefined> = {
    [ProfileEditorPage.BetterAvatar]: i18n('icu:ProfileEditorModal--avatar'),
    [ProfileEditorPage.Bio]: i18n('icu:ProfileEditorModal--about'),
    [ProfileEditorPage.None]: i18n('icu:ProfileEditorModal--profile'),
    [ProfileEditorPage.ProfileName]: i18n('icu:ProfileEditorModal--name'),
    [ProfileEditorPage.Username]: i18n('icu:ProfileEditorModal--username'),
    [ProfileEditorPage.UsernameLink]: i18n('icu:ProfileEditorModal--sharing'),
  };

  // This is here to avoid component re-render jitters in the time it takes
  // redux to come back with the correct state
  const [fullName, setFullName] = useState({
    familyName,
    firstName,
  });
  const [fullBio, setFullBio] = useState({
    aboutEmoji,
    aboutText,
  });
  const [startingAvatarUrl, setStartingAvatarUrl] = useState(profileAvatarUrl);

  const [oldAvatarBuffer, setOldAvatarBuffer] = useState<
    Uint8Array | undefined
  >(undefined);
  const [avatarBuffer, setAvatarBuffer] = useState<Uint8Array | undefined>(
    undefined
  );
  const [stagedProfile, setStagedProfile] = useState<ProfileEditorData>({
    aboutEmoji,
    aboutText,
    familyName,
    firstName,
  });
  const [isResettingUsername, setIsResettingUsername] = useState(false);
  const [isResettingUsernameLink, setIsResettingUsernameLink] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  const stagedAboutEmojiVariantKey = useMemo(() => {
    if (
      stagedProfile.aboutEmoji == null ||
      !isEmojiVariantValue(stagedProfile.aboutEmoji)
    ) {
      return null;
    }
    return getEmojiVariantKeyByValue(stagedProfile.aboutEmoji);
  }, [stagedProfile.aboutEmoji]);

  // Reset username edit state when leaving
  useEffect(() => {
    return () => {
      setUsernameEditState(UsernameEditState.Editing);
    };
  }, [setUsernameEditState]);

  // To make AvatarEditor re-render less often
  const handleBack = useCallback(() => {
    setEditState(ProfileEditorPage.None);
  }, [setEditState]);

  const handleEmojiPickerOpenChange = useCallback((open: boolean) => {
    setEmojiPickerOpen(open);
  }, []);

  const handleSelectEmoji = useCallback(
    (emojiSelection: FunEmojiSelection) => {
      const emojiVariant = getEmojiVariantByKey(emojiSelection.variantKey);

      setStagedProfile(profileData => ({
        ...profileData,
        aboutEmoji: emojiVariant.value,
      }));
    },
    [setStagedProfile]
  );

  // To make AvatarEditor re-render less often
  const handleAvatarChanged = useCallback(
    (avatar: Uint8Array | undefined) => {
      // Do not display stale avatar from disk anymore.
      setStartingAvatarUrl(undefined);

      setAvatarBuffer(avatar);
      onProfileChanged(
        {
          ...stagedProfile,
          firstName: trim(stagedProfile.firstName),
          familyName: stagedProfile.familyName
            ? trim(stagedProfile.familyName)
            : undefined,
        },
        {
          keepAvatar: false,
          avatarUpdate: { oldAvatar: oldAvatarBuffer, newAvatar: avatar },
        }
      );
      setOldAvatarBuffer(avatar);
      handleBack();
    },
    [handleBack, oldAvatarBuffer, onProfileChanged, stagedProfile]
  );

  const getFullNameText = () => {
    return [fullName.firstName, fullName.familyName].filter(Boolean).join(' ');
  };

  useEffect(() => {
    const focusNode = focusInputRef.current;
    if (!focusNode) {
      return;
    }

    focusNode.focus();
    focusNode.setSelectionRange(focusNode.value.length, focusNode.value.length);
  }, [editState]);

  // To make AvatarEditor re-render less often
  const handleAvatarLoaded = useCallback(
    (avatar: Uint8Array) => {
      setAvatarBuffer(avatar);
      setOldAvatarBuffer(avatar);
    },
    [setAvatarBuffer, setOldAvatarBuffer]
  );

  const onTryClose = useCallback(() => {
    const hasNameChanges =
      stagedProfile.familyName !== fullName.familyName ||
      stagedProfile.firstName !== fullName.firstName;
    const hasAboutChanges =
      stagedProfile.aboutText !== fullBio.aboutText ||
      stagedProfile.aboutEmoji !== fullBio.aboutEmoji;
    const onDiscard = () => {
      setStagedProfile(profileData => ({
        ...profileData,
        ...fullName,
        ...fullBio,
      }));
    };

    confirmDiscardIf(hasNameChanges || hasAboutChanges, onDiscard);
  }, [confirmDiscardIf, stagedProfile, fullName, fullBio, setStagedProfile]);
  tryClose.current = onTryClose;

  let content: JSX.Element;

  if (editState === ProfileEditorPage.BetterAvatar) {
    content = (
      <AvatarEditor
        avatarColor={color || AvatarColors[0]}
        avatarUrl={startingAvatarUrl}
        avatarValue={avatarBuffer}
        conversationId={conversationId}
        conversationTitle={getFullNameText()}
        deleteAvatarFromDisk={deleteAvatarFromDisk}
        i18n={i18n}
        onCancel={handleBack}
        onSave={handleAvatarChanged}
        userAvatarData={userAvatarData}
        replaceAvatar={replaceAvatar}
        saveAvatarToDisk={saveAvatarToDisk}
      />
    );
  } else if (editState === ProfileEditorPage.ProfileName) {
    const shouldDisableSave =
      !stagedProfile.firstName ||
      (stagedProfile.firstName === fullName.firstName &&
        stagedProfile.familyName === fullName.familyName) ||
      isWhitespace(stagedProfile.firstName);

    content = (
      <>
        <Input
          i18n={i18n}
          maxLengthCount={26}
          maxByteCount={128}
          onChange={newFirstName => {
            setStagedProfile(profileData => ({
              ...profileData,
              firstName: String(newFirstName),
            }));
          }}
          placeholder={i18n('icu:ProfileEditor--first-name')}
          ref={focusInputRef}
          value={stagedProfile.firstName}
        />
        <Input
          i18n={i18n}
          maxLengthCount={26}
          maxByteCount={128}
          onChange={newFamilyName => {
            setStagedProfile(profileData => ({
              ...profileData,
              familyName: newFamilyName,
            }));
          }}
          placeholder={i18n('icu:ProfileEditor--last-name')}
          value={stagedProfile.familyName}
        />
        <div className="ProfileEditor__button-footer">
          <AxoButton.Root variant="secondary" size="large" onClick={handleBack}>
            {i18n('icu:cancel')}
          </AxoButton.Root>
          <AxoButton.Root
            variant="primary"
            size="large"
            disabled={shouldDisableSave}
            onClick={() => {
              if (!stagedProfile.firstName) {
                return;
              }
              setFullName({
                firstName: stagedProfile.firstName,
                familyName: stagedProfile.familyName,
              });

              onProfileChanged(stagedProfile, { keepAvatar: true });

              // Delay navigation until setFullName resolves and we are no longer dirty
              setTimeout(() => handleBack(), 500);
            }}
          >
            {i18n('icu:save')}
          </AxoButton.Root>
        </div>
      </>
    );
  } else if (editState === ProfileEditorPage.Bio) {
    const shouldDisableSave =
      stagedProfile.aboutText === fullBio.aboutText &&
      stagedProfile.aboutEmoji === fullBio.aboutEmoji;

    const defaultBios = getDefaultBios(i18n);

    content = (
      <>
        <Input
          expandable
          hasClearButton
          i18n={i18n}
          icon={
            <div className="module-composition-area__button-cell">
              <FunEmojiPicker
                open={emojiPickerOpen}
                onOpenChange={handleEmojiPickerOpenChange}
                placement="bottom"
                onSelectEmoji={handleSelectEmoji}
                closeOnSelect
              >
                <FunEmojiPickerButton
                  i18n={i18n}
                  selectedEmoji={stagedAboutEmojiVariantKey}
                />
              </FunEmojiPicker>
            </div>
          }
          maxLengthCount={140}
          maxByteCount={512}
          moduleClassName="ProfileEditor__about-input"
          onChange={value => {
            if (value) {
              setStagedProfile(profileData => ({
                ...profileData,
                aboutEmoji: stagedProfile.aboutEmoji,
                aboutText: value.replace(/(\r\n|\n|\r)/gm, ''),
              }));
            } else {
              setStagedProfile(profileData => ({
                ...profileData,
                aboutEmoji: undefined,
                aboutText: '',
              }));
            }
          }}
          ref={focusInputRef}
          placeholder={i18n('icu:ProfileEditor--about-placeholder')}
          value={stagedProfile.aboutText}
          whenToShowRemainingCount={40}
        />

        {defaultBios.map(defaultBio => {
          const emojiVariant = getEmojiVariantByParentKeyAndSkinTone(
            defaultBio.emojiParentKey,
            emojiSkinToneDefault ?? EmojiSkinTone.None
          );

          return (
            <PanelRow
              className="ProfileEditor__row"
              key={defaultBio.emojiParentKey}
              icon={
                <div className="ProfileEditor__icon--container">
                  <BioEmoji emoji={emojiVariant.key} />
                </div>
              }
              label={defaultBio.i18nLabel}
              onClick={() => {
                setStagedProfile(profileData => ({
                  ...profileData,
                  aboutEmoji: emojiVariant.value,
                  aboutText: defaultBio.i18nLabel,
                }));
              }}
            />
          );
        })}

        <div className="ProfileEditor__button-footer">
          <AxoButton.Root variant="secondary" size="large" onClick={handleBack}>
            {i18n('icu:cancel')}
          </AxoButton.Root>
          <AxoButton.Root
            variant="primary"
            size="large"
            disabled={shouldDisableSave}
            onClick={() => {
              setFullBio({
                aboutEmoji: stagedProfile.aboutEmoji,
                aboutText: stagedProfile.aboutText,
              });

              onProfileChanged(stagedProfile, { keepAvatar: true });

              // Delay navigation until setFullBio resolves and we are no longer dirty
              setTimeout(() => handleBack(), 500);
            }}
          >
            {i18n('icu:save')}
          </AxoButton.Root>
        </div>
      </>
    );
  } else if (editState === ProfileEditorPage.Username) {
    content = renderUsernameEditor({
      onClose: handleBack,
    });
  } else if (editState === ProfileEditorPage.UsernameLink) {
    content = (
      <UsernameLinkEditor
        i18n={i18n}
        link={usernameLink}
        username={username ?? ''}
        colorId={usernameLinkColor}
        usernameLinkCorrupted={usernameLinkCorrupted}
        usernameLinkState={usernameLinkState}
        setUsernameLinkColor={setUsernameLinkColor}
        resetUsernameLink={resetUsernameLink}
        saveAttachment={saveAttachment}
        showToast={showToast}
        onBack={() => setEditState(ProfileEditorPage.None)}
      />
    );
  } else if (editState === ProfileEditorPage.None) {
    let actions: JSX.Element | undefined;
    let alwaysShowActions = false;

    if (usernameEditState === UsernameEditState.Deleting) {
      actions = (
        <ConversationDetailsIcon
          ariaLabel={i18n('icu:ProfileEditor--username--deleting-username')}
          icon={IconType.spinner}
          disabled
          fakeButton
        />
      );
    } else {
      const menuOptions = [
        {
          group: 'copy',
          icon: 'ProfileEditor__username-menu__copy-icon',
          label: i18n('icu:ProfileEditor--username--copy'),
          onClick: () => {
            assertDev(
              username !== undefined,
              'Should not be visible without username'
            );
            void window.navigator.clipboard.writeText(username);
            showToast({ toastType: ToastType.CopiedUsername });
          },
        },
        {
          // Different group to display a divider above it
          group: 'delete',

          icon: 'ProfileEditor__username-menu__trash-icon',
          label: i18n('icu:ProfileEditor--username--delete'),
          onClick: () => {
            setUsernameEditState(UsernameEditState.ConfirmingDelete);
          },
        },
      ];

      if (usernameCorrupted) {
        actions = (
          <i
            className="ProfileEditor__error-icon"
            title={i18n('icu:ProfileEditor__username__error-icon')}
          />
        );
        alwaysShowActions = true;
      } else if (username) {
        actions = (
          <ContextMenu
            i18n={i18n}
            menuOptions={menuOptions}
            popperOptions={{ placement: 'bottom', strategy: 'absolute' }}
            moduleClassName="ProfileEditor__username-menu"
            ariaLabel={i18n('icu:ProfileEditor--username--context-menu')}
          />
        );
      }
    }

    let maybeUsernameLinkRow: JSX.Element | undefined;
    if (username && !usernameCorrupted) {
      let linkActions: JSX.Element | undefined;

      if (usernameLinkCorrupted) {
        linkActions = (
          <i
            className="ProfileEditor__error-icon"
            title={i18n('icu:ProfileEditor__username-link__error-icon')}
          />
        );
      }

      maybeUsernameLinkRow = (
        <PanelRow
          className="ProfileEditor__row"
          icon={
            <i className="ProfileEditor__icon--container ProfileEditor__icon ProfileEditor__icon--username-link" />
          }
          label={i18n('icu:ProfileEditor__username-link')}
          onClick={() => {
            markCompletedUsernameLinkOnboarding();

            if (usernameLinkCorrupted) {
              setIsResettingUsernameLink(true);
              return;
            }

            setEditState(ProfileEditorPage.UsernameLink);
          }}
          alwaysShowActions
          actions={linkActions}
        />
      );

      if (!hasCompletedUsernameLinkOnboarding && !usernameLink) {
        maybeUsernameLinkRow = (
          <UsernameLinkTooltip
            handleClose={markCompletedUsernameLinkOnboarding}
            i18n={i18n}
          >
            {maybeUsernameLinkRow}
          </UsernameLinkTooltip>
        );
      }
    }

    const usernameRows = (
      <>
        <hr className="ProfileEditor__divider" />
        <PanelRow
          className="ProfileEditor__row"
          icon={
            <i className="ProfileEditor__icon--container ProfileEditor__icon ProfileEditor__icon--username" />
          }
          label={
            (!usernameCorrupted && username) ||
            i18n('icu:ProfileEditor--username')
          }
          onClick={() => {
            if (usernameCorrupted) {
              setIsResettingUsername(true);
              return;
            }

            openUsernameReservationModal();
            setEditState(ProfileEditorPage.Username);
          }}
          alwaysShowActions={alwaysShowActions}
          actions={actions}
        />
        {maybeUsernameLinkRow}
        <div className="ProfileEditor__info">
          {username
            ? i18n('icu:ProfileEditor--info--pnp')
            : i18n('icu:ProfileEditor--info--pnp--no-username')}
        </div>
      </>
    );

    content = (
      <>
        <AvatarPreview
          avatarColor={color}
          avatarUrl={startingAvatarUrl}
          avatarValue={avatarBuffer}
          conversationTitle={getFullNameText()}
          i18n={i18n}
          onAvatarLoaded={handleAvatarLoaded}
          onClick={() => {
            setEditState(ProfileEditorPage.BetterAvatar);
          }}
          style={{
            height: 80,
            width: 80,
          }}
        />
        <div className="ProfileEditor__EditPhotoContainer">
          <AxoButton.Root
            onClick={() => {
              setEditState(ProfileEditorPage.BetterAvatar);
            }}
            variant="secondary"
            size="small"
          >
            {i18n('icu:ProfileEditor--edit-photo')}
          </AxoButton.Root>
        </div>
        <PanelRow
          className="ProfileEditor__row"
          icon={
            <i className="ProfileEditor__icon--container ProfileEditor__icon ProfileEditor__icon--name" />
          }
          label={<UserText text={getFullNameText()} />}
          onClick={() => {
            setEditState(ProfileEditorPage.ProfileName);
          }}
        />
        <PanelRow
          className="ProfileEditor__row"
          icon={
            fullBio.aboutEmoji && isEmojiVariantValue(fullBio.aboutEmoji) ? (
              <div className="ProfileEditor__icon--container">
                <BioEmoji
                  emoji={getEmojiVariantKeyByValue(fullBio.aboutEmoji)}
                />
              </div>
            ) : (
              <i className="ProfileEditor__icon--container ProfileEditor__icon ProfileEditor__icon--bio" />
            )
          }
          label={
            <UserText
              text={fullBio.aboutText || i18n('icu:ProfileEditor--about')}
            />
          }
          onClick={() => {
            setEditState(ProfileEditorPage.Bio);
          }}
        />
        <div className="ProfileEditor__info">
          {i18n('icu:ProfileEditor--info--general')}
        </div>
        {usernameRows}
      </>
    );
  } else {
    throw missingCaseError(editState);
  }

  const backButton =
    editState !== ProfileEditorPage.None ? (
      <button
        aria-label={i18n('icu:goBack')}
        className="Preferences__back-icon"
        onClick={handleBack}
        type="button"
      />
    ) : undefined;

  return (
    <>
      {usernameEditState === UsernameEditState.ConfirmingDelete && (
        <ConfirmationDialog
          dialogName="ProfileEditor.confirmDeleteUsername"
          i18n={i18n}
          onClose={() => setUsernameEditState(UsernameEditState.Editing)}
          actions={[
            {
              text: i18n('icu:ProfileEditor--username--confirm-delete-button'),
              style: 'negative',
              action: () => deleteUsername(),
            },
          ]}
        >
          {i18n('icu:ProfileEditor--username--confirm-delete-body-2', {
            username: username ?? '',
          })}
        </ConfirmationDialog>
      )}

      {confirmDiscardModal}

      {isResettingUsernameLink && (
        <ConfirmationDialog
          i18n={i18n}
          dialogName="ProfileEditor__resettingUsername"
          onClose={() => setIsResettingUsernameLink(false)}
          cancelButtonVariant={ButtonVariant.Secondary}
          cancelText={i18n('icu:cancel')}
          actions={[
            {
              action: () => {
                setIsResettingUsernameLink(false);
                setEditState(ProfileEditorPage.UsernameLink);
              },
              style: 'affirmative',
              text: i18n('icu:UsernameLinkModalBody__error__fix-now'),
            },
          ]}
        >
          {i18n('icu:UsernameLinkModalBody__error__text')}
        </ConfirmationDialog>
      )}

      {isResettingUsername && (
        <ConfirmationDialog
          dialogName="ProfileEditor.confirmResetUsername"
          moduleClassName="ProfileEditor__reset-username-modal"
          i18n={i18n}
          onClose={() => setIsResettingUsername(false)}
          actions={[
            {
              text: i18n('icu:ProfileEditor--username--corrupted--fix-button'),
              style: 'affirmative',
              action: () => {
                openUsernameReservationModal();
                setEditState(ProfileEditorPage.Username);
              },
            },
          ]}
        >
          {i18n('icu:ProfileEditor--username--corrupted--body')}
        </ConfirmationDialog>
      )}

      <PreferencesContent
        backButton={backButton}
        contents={<div className="ProfileEditor">{content}</div>}
        contentsRef={contentsRef}
        title={TITLES_BY_EDIT_STATE[editState]}
      />
    </>
  );
}

function UsernameLinkTooltip({
  handleClose,
  children,
  i18n,
}: {
  handleClose: VoidFunction;
  children: React.ReactNode;
  i18n: LocalizerType;
}) {
  const reducedMotion = useReducedMotion();
  const animatedStyles = useSpring({
    from: { opacity: 0, scale: reducedMotion ? 1 : 0.25 },
    to: { opacity: 1, scale: 1 },
    config: { mass: 1, tension: 280, friction: 25 },
    delay: 200,
  });
  const tooltip = (
    <animated.div
      className="ProfileEditor__username-link__tooltip__container"
      style={animatedStyles}
    >
      <div className="ProfileEditor__username-link__tooltip__icon" />

      <div className="ProfileEditor__username-link__tooltip__content">
        <h3>{i18n('icu:ProfileEditor__username-link__tooltip__title')}</h3>
        <p>{i18n('icu:ProfileEditor__username-link__tooltip__body')}</p>
      </div>

      <button
        type="button"
        className="ProfileEditor__username-link__tooltip__close"
        onClick={handleClose}
        aria-label={i18n('icu:close')}
      />
      <div className="ProfileEditor__username-link__tooltip__arrow" />
    </animated.div>
  );

  return (
    <Tooltip
      className="ProfileEditor__username-link__tooltip"
      direction={TooltipPlacement.Bottom}
      sticky
      content={tooltip}
      // By default tooltip has its distance modified, here we clear that
      popperModifiers={[offsetDistanceModifier(0)]}
      hideArrow
    >
      {children}
    </Tooltip>
  );
}
