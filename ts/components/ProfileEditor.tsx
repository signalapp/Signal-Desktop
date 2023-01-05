// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useRef, useState } from 'react';

import type { AvatarColorType } from '../types/Colors';
import { AvatarColors } from '../types/Colors';
import type {
  AvatarDataType,
  AvatarUpdateType,
  DeleteAvatarFromDiskActionType,
  ReplaceAvatarActionType,
  SaveAvatarToDiskActionType,
} from '../types/Avatar';
import { AvatarEditor } from './AvatarEditor';
import { AvatarPreview } from './AvatarPreview';
import { Button, ButtonVariant } from './Button';
import { ConfirmDiscardDialog } from './ConfirmDiscardDialog';
import { Emoji } from './emoji/Emoji';
import type { Props as EmojiButtonProps } from './emoji/EmojiButton';
import { EmojiButton, EmojiButtonVariant } from './emoji/EmojiButton';
import type { EmojiPickDataType } from './emoji/EmojiPicker';
import { Input } from './Input';
import { Intl } from './Intl';
import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { PanelRow } from './conversation/conversation-details/PanelRow';
import type { ProfileDataType } from '../state/ducks/conversations';
import { UsernameEditState } from '../state/ducks/usernameEnums';
import { ToastType } from '../types/Toast';
import type { ShowToastActionCreatorType } from '../state/ducks/toast';
import { getEmojiData, unifiedToEmoji } from './emoji/lib';
import { assertDev } from '../util/assert';
import { missingCaseError } from '../util/missingCaseError';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenu } from './ContextMenu';
import {
  ConversationDetailsIcon,
  IconType,
} from './conversation/conversation-details/ConversationDetailsIcon';
import { isWhitespace, trim } from '../util/whitespaceStringUtil';
import { generateUsernameLink } from '../util/sgnlHref';
import { Emojify } from './conversation/Emojify';

export enum EditState {
  None = 'None',
  BetterAvatar = 'BetterAvatar',
  ProfileName = 'ProfileName',
  Bio = 'Bio',
  Username = 'Username',
}

type PropsExternalType = {
  onEditStateChanged: (editState: EditState) => unknown;
  onProfileChanged: (
    profileData: ProfileDataType,
    avatar: AvatarUpdateType
  ) => unknown;
  renderEditUsernameModalBody: (props: { onClose: () => void }) => JSX.Element;
};

export type PropsDataType = {
  aboutEmoji?: string;
  aboutText?: string;
  profileAvatarPath?: string;
  color?: AvatarColorType;
  conversationId: string;
  familyName?: string;
  firstName: string;
  i18n: LocalizerType;
  isUsernameFlagEnabled: boolean;
  userAvatarData: ReadonlyArray<AvatarDataType>;
  username?: string;
  usernameEditState: UsernameEditState;
} & Pick<EmojiButtonProps, 'recentEmojis' | 'skinTone'>;

type PropsActionType = {
  deleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  onSetSkinTone: (tone: number) => unknown;
  replaceAvatar: ReplaceAvatarActionType;
  saveAvatarToDisk: SaveAvatarToDiskActionType;
  setUsernameEditState: (editState: UsernameEditState) => void;
  deleteUsername: () => void;
  showToast: ShowToastActionCreatorType;
  openUsernameReservationModal: () => void;
};

export type PropsType = PropsDataType & PropsActionType & PropsExternalType;

type DefaultBio = {
  i18nLabel: string;
  shortName: string;
};

const DEFAULT_BIOS: Array<DefaultBio> = [
  {
    i18nLabel: 'Bio--speak-freely',
    shortName: 'wave',
  },
  {
    i18nLabel: 'Bio--encrypted',
    shortName: 'zipper_mouth_face',
  },
  {
    i18nLabel: 'Bio--free-to-chat',
    shortName: '+1',
  },
  {
    i18nLabel: 'Bio--coffee-lover',
    shortName: 'coffee',
  },
  {
    i18nLabel: 'Bio--taking-break',
    shortName: 'mobile_phone_off',
  },
];

export function ProfileEditor({
  aboutEmoji,
  aboutText,
  color,
  conversationId,
  deleteAvatarFromDisk,
  deleteUsername,
  familyName,
  firstName,
  i18n,
  isUsernameFlagEnabled,
  onEditStateChanged,
  onProfileChanged,
  onSetSkinTone,
  openUsernameReservationModal,
  profileAvatarPath,
  recentEmojis,
  renderEditUsernameModalBody,
  replaceAvatar,
  saveAvatarToDisk,
  setUsernameEditState,
  showToast,
  skinTone,
  userAvatarData,
  username,
  usernameEditState,
}: PropsType): JSX.Element {
  const focusInputRef = useRef<HTMLInputElement | null>(null);
  const [editState, setEditState] = useState<EditState>(EditState.None);
  const [confirmDiscardAction, setConfirmDiscardAction] = useState<
    (() => unknown) | undefined
  >(undefined);

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
  const [startingAvatarPath, setStartingAvatarPath] =
    useState(profileAvatarPath);

  const [oldAvatarBuffer, setOldAvatarBuffer] = useState<
    Uint8Array | undefined
  >(undefined);
  const [avatarBuffer, setAvatarBuffer] = useState<Uint8Array | undefined>(
    undefined
  );
  const [isLoadingAvatar, setIsLoadingAvatar] = useState(
    Boolean(profileAvatarPath)
  );
  const [stagedProfile, setStagedProfile] = useState<ProfileDataType>({
    aboutEmoji,
    aboutText,
    familyName,
    firstName,
  });

  // Reset username edit state when leaving
  useEffect(() => {
    return () => {
      setUsernameEditState(UsernameEditState.Editing);
    };
  }, [setUsernameEditState]);

  // To make AvatarEditor re-render less often
  const handleBack = useCallback(() => {
    setEditState(EditState.None);
    onEditStateChanged(EditState.None);
  }, [setEditState, onEditStateChanged]);

  // To make EmojiButton re-render less often
  const setAboutEmoji = useCallback(
    (ev: EmojiPickDataType) => {
      const emojiData = getEmojiData(ev.shortName, skinTone);
      setStagedProfile(profileData => ({
        ...profileData,
        aboutEmoji: unifiedToEmoji(emojiData.unified),
      }));
    },
    [setStagedProfile, skinTone]
  );

  // To make AvatarEditor re-render less often
  const handleAvatarChanged = useCallback(
    (avatar: Uint8Array | undefined) => {
      // Do not display stale avatar from disk anymore.
      setStartingAvatarPath(undefined);

      setAvatarBuffer(avatar);
      setEditState(EditState.None);
      onProfileChanged(
        {
          ...stagedProfile,
          firstName: trim(stagedProfile.firstName),
          familyName: stagedProfile.familyName
            ? trim(stagedProfile.familyName)
            : undefined,
        },
        { oldAvatar: oldAvatarBuffer, newAvatar: avatar }
      );
      setOldAvatarBuffer(avatar);
    },
    [onProfileChanged, stagedProfile, oldAvatarBuffer]
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

  useEffect(() => {
    onEditStateChanged(editState);
  }, [editState, onEditStateChanged]);

  // To make AvatarEditor re-render less often
  const handleAvatarLoaded = useCallback(
    avatar => {
      setAvatarBuffer(avatar);
      setOldAvatarBuffer(avatar);
      setIsLoadingAvatar(false);
    },
    [setAvatarBuffer, setOldAvatarBuffer, setIsLoadingAvatar]
  );

  let content: JSX.Element;

  if (editState === EditState.BetterAvatar) {
    content = (
      <AvatarEditor
        avatarColor={color || AvatarColors[0]}
        avatarPath={startingAvatarPath}
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
  } else if (editState === EditState.ProfileName) {
    const shouldDisableSave =
      isLoadingAvatar ||
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
          whenToShowRemainingCount={0}
          onChange={newFirstName => {
            setStagedProfile(profileData => ({
              ...profileData,
              firstName: String(newFirstName),
            }));
          }}
          placeholder={i18n('ProfileEditor--first-name')}
          ref={focusInputRef}
          value={stagedProfile.firstName}
        />
        <Input
          i18n={i18n}
          maxLengthCount={26}
          maxByteCount={128}
          whenToShowRemainingCount={0}
          onChange={newFamilyName => {
            setStagedProfile(profileData => ({
              ...profileData,
              familyName: newFamilyName,
            }));
          }}
          placeholder={i18n('ProfileEditor--last-name')}
          value={stagedProfile.familyName}
        />
        <Modal.ButtonFooter>
          <Button
            onClick={() => {
              const handleCancel = () => {
                handleBack();
                setStagedProfile(profileData => ({
                  ...profileData,
                  familyName,
                  firstName,
                }));
              };

              const hasChanges =
                stagedProfile.familyName !== fullName.familyName ||
                stagedProfile.firstName !== fullName.firstName;
              if (hasChanges) {
                setConfirmDiscardAction(() => handleCancel);
              } else {
                handleCancel();
              }
            }}
            variant={ButtonVariant.Secondary}
          >
            {i18n('cancel')}
          </Button>
          <Button
            disabled={shouldDisableSave}
            onClick={() => {
              if (!stagedProfile.firstName) {
                return;
              }
              setFullName({
                firstName: stagedProfile.firstName,
                familyName: stagedProfile.familyName,
              });

              onProfileChanged(stagedProfile, {
                oldAvatar: oldAvatarBuffer,
                newAvatar: avatarBuffer,
              });
              handleBack();
            }}
          >
            {i18n('save')}
          </Button>
        </Modal.ButtonFooter>
      </>
    );
  } else if (editState === EditState.Bio) {
    const shouldDisableSave =
      isLoadingAvatar ||
      (stagedProfile.aboutText === fullBio.aboutText &&
        stagedProfile.aboutEmoji === fullBio.aboutEmoji);

    content = (
      <>
        <Input
          expandable
          hasClearButton
          i18n={i18n}
          icon={
            <div className="module-composition-area__button-cell">
              <EmojiButton
                variant={EmojiButtonVariant.ProfileEditor}
                closeOnPick
                emoji={stagedProfile.aboutEmoji}
                i18n={i18n}
                onPickEmoji={setAboutEmoji}
                onSetSkinTone={onSetSkinTone}
                recentEmojis={recentEmojis}
                skinTone={skinTone}
              />
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
          placeholder={i18n('ProfileEditor--about-placeholder')}
          value={stagedProfile.aboutText}
          whenToShowRemainingCount={40}
        />

        {DEFAULT_BIOS.map(defaultBio => (
          <PanelRow
            className="ProfileEditor__row"
            key={defaultBio.shortName}
            icon={
              <div className="ProfileEditor__icon--container">
                <Emoji shortName={defaultBio.shortName} size={24} />
              </div>
            }
            // eslint-disable-next-line local-rules/valid-i18n-keys
            label={i18n(defaultBio.i18nLabel)}
            onClick={() => {
              const emojiData = getEmojiData(defaultBio.shortName, skinTone);

              setStagedProfile(profileData => ({
                ...profileData,
                aboutEmoji: unifiedToEmoji(emojiData.unified),
                // eslint-disable-next-line local-rules/valid-i18n-keys
                aboutText: i18n(defaultBio.i18nLabel),
              }));
            }}
          />
        ))}

        <Modal.ButtonFooter>
          <Button
            onClick={() => {
              const handleCancel = () => {
                handleBack();
                setStagedProfile(profileData => ({
                  ...profileData,
                  ...fullBio,
                }));
              };

              const hasChanges =
                stagedProfile.aboutText !== fullBio.aboutText ||
                stagedProfile.aboutEmoji !== fullBio.aboutEmoji;
              if (hasChanges) {
                setConfirmDiscardAction(() => handleCancel);
              } else {
                handleCancel();
              }
            }}
            variant={ButtonVariant.Secondary}
          >
            {i18n('cancel')}
          </Button>
          <Button
            disabled={shouldDisableSave}
            onClick={() => {
              setFullBio({
                aboutEmoji: stagedProfile.aboutEmoji,
                aboutText: stagedProfile.aboutText,
              });

              onProfileChanged(stagedProfile, {
                oldAvatar: oldAvatarBuffer,
                newAvatar: avatarBuffer,
              });
              handleBack();
            }}
          >
            {i18n('save')}
          </Button>
        </Modal.ButtonFooter>
      </>
    );
  } else if (editState === EditState.Username) {
    content = renderEditUsernameModalBody({
      onClose: () => setEditState(EditState.None),
    });
  } else if (editState === EditState.None) {
    let maybeUsernameRow: JSX.Element | undefined;
    if (isUsernameFlagEnabled) {
      let actions: JSX.Element | undefined;

      if (usernameEditState === UsernameEditState.Deleting) {
        actions = (
          <ConversationDetailsIcon
            ariaLabel={i18n('ProfileEditor--username--deleting-username')}
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
            label: i18n('ProfileEditor--username--copy'),
            onClick: () => {
              assertDev(
                username !== undefined,
                'Should not be visible without username'
              );
              void window.navigator.clipboard.writeText(username);
              showToast(ToastType.CopiedUsername);
            },
          },
          {
            group: 'copy',
            icon: 'ProfileEditor__username-menu__copy-link-icon',
            label: i18n('ProfileEditor--username--copy-link'),
            onClick: () => {
              assertDev(
                username !== undefined,
                'Should not be visible without username'
              );
              void window.navigator.clipboard.writeText(
                generateUsernameLink(username)
              );
              showToast(ToastType.CopiedUsernameLink);
            },
          },
          {
            // Different group to display a divider above it
            group: 'delete',

            icon: 'ProfileEditor__username-menu__trash-icon',
            label: i18n('ProfileEditor--username--delete'),
            onClick: () => {
              setUsernameEditState(UsernameEditState.ConfirmingDelete);
            },
          },
        ];

        if (username) {
          actions = (
            <ContextMenu
              i18n={i18n}
              menuOptions={menuOptions}
              popperOptions={{ placement: 'bottom', strategy: 'absolute' }}
              moduleClassName="ProfileEditor__username-menu"
              ariaLabel={i18n('ProfileEditor--username--context-menu')}
            />
          );
        }
      }

      maybeUsernameRow = (
        <PanelRow
          className="ProfileEditor__row"
          icon={
            <i className="ProfileEditor__icon--container ProfileEditor__icon ProfileEditor__icon--username" />
          }
          label={username || i18n('ProfileEditor--username')}
          info={username && generateUsernameLink(username, { short: true })}
          onClick={() => {
            openUsernameReservationModal();
            setEditState(EditState.Username);
          }}
          actions={actions}
        />
      );
    }

    content = (
      <>
        <AvatarPreview
          avatarColor={color}
          avatarPath={startingAvatarPath}
          avatarValue={avatarBuffer}
          conversationTitle={getFullNameText()}
          i18n={i18n}
          isEditable
          onAvatarLoaded={handleAvatarLoaded}
          onClick={() => {
            setEditState(EditState.BetterAvatar);
          }}
          style={{
            height: 80,
            width: 80,
          }}
        />
        <hr className="ProfileEditor__divider" />
        <PanelRow
          className="ProfileEditor__row"
          icon={
            <i className="ProfileEditor__icon--container ProfileEditor__icon ProfileEditor__icon--name" />
          }
          label={<Emojify text={getFullNameText()} />}
          onClick={() => {
            setEditState(EditState.ProfileName);
          }}
        />
        {maybeUsernameRow}
        <PanelRow
          className="ProfileEditor__row"
          icon={
            fullBio.aboutEmoji ? (
              <div className="ProfileEditor__icon--container">
                <Emoji emoji={fullBio.aboutEmoji} size={24} />
              </div>
            ) : (
              <i className="ProfileEditor__icon--container ProfileEditor__icon ProfileEditor__icon--bio" />
            )
          }
          label={
            <Emojify text={fullBio.aboutText || i18n('ProfileEditor--about')} />
          }
          onClick={() => {
            setEditState(EditState.Bio);
          }}
        />
        <hr className="ProfileEditor__divider" />
        <div className="ProfileEditor__info">
          <Intl
            i18n={i18n}
            id="icu:ProfileEditor--info"
            components={{
              learnMore: (
                <a
                  href="https://support.signal.org/hc/en-us/articles/360007459591"
                  target="_blank"
                  rel="noreferrer"
                >
                  {i18n('ProfileEditor--learnMore')}
                </a>
              ),
            }}
          />
        </div>
      </>
    );
  } else {
    throw missingCaseError(editState);
  }

  return (
    <>
      {usernameEditState === UsernameEditState.ConfirmingDelete && (
        <ConfirmationDialog
          dialogName="ProfileEditor.confirmDeleteUsername"
          i18n={i18n}
          onClose={() => setUsernameEditState(UsernameEditState.Editing)}
          actions={[
            {
              text: i18n('ProfileEditor--username--confirm-delete-button'),
              style: 'negative',
              action: () => deleteUsername(),
            },
          ]}
        >
          {i18n('ProfileEditor--username--confirm-delete-body')}
        </ConfirmationDialog>
      )}

      {confirmDiscardAction && (
        <ConfirmDiscardDialog
          i18n={i18n}
          onDiscard={confirmDiscardAction}
          onClose={() => setConfirmDiscardAction(undefined)}
        />
      )}
      <div className="ProfileEditor">{content}</div>
    </>
  );
}
