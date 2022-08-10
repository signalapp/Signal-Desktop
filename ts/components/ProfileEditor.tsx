// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';

import * as log from '../logging/log';
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
import { EmojiButton } from './emoji/EmojiButton';
import type { EmojiPickDataType } from './emoji/EmojiPicker';
import { Input } from './Input';
import { Intl } from './Intl';
import type { LocalizerType, ReplacementValuesType } from '../types/Util';
import { Modal } from './Modal';
import { PanelRow } from './conversation/conversation-details/PanelRow';
import type { ProfileDataType } from '../state/ducks/conversations';
import { getEmojiData, unifiedToEmoji } from './emoji/lib';
import { missingCaseError } from '../util/missingCaseError';
import { ConfirmationDialog } from './ConfirmationDialog';
import {
  ConversationDetailsIcon,
  IconType,
} from './conversation/conversation-details/ConversationDetailsIcon';
import { Spinner } from './Spinner';
import { UsernameSaveState } from '../state/ducks/conversationsEnums';
import { MAX_USERNAME, MIN_USERNAME } from '../types/Username';
import { isWhitespace, trim } from '../util/whitespaceStringUtil';
import { Emojify } from './conversation/Emojify';

export enum EditState {
  None = 'None',
  BetterAvatar = 'BetterAvatar',
  ProfileName = 'ProfileName',
  Bio = 'Bio',
  Username = 'Username',
}

enum UsernameEditState {
  Editing = 'Editing',
  ConfirmingDelete = 'ConfirmingDelete',
  ShowingErrorPopup = 'ShowingErrorPopup',
  Saving = 'Saving',
}

type PropsExternalType = {
  onEditStateChanged: (editState: EditState) => unknown;
  onProfileChanged: (
    profileData: ProfileDataType,
    avatar: AvatarUpdateType
  ) => unknown;
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
  usernameSaveState: UsernameSaveState;
  userAvatarData: Array<AvatarDataType>;
  username?: string;
} & Pick<EmojiButtonProps, 'recentEmojis' | 'skinTone'>;

type PropsActionType = {
  clearUsernameSave: () => unknown;
  deleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  onSetSkinTone: (tone: number) => unknown;
  replaceAvatar: ReplaceAvatarActionType;
  saveAvatarToDisk: SaveAvatarToDiskActionType;
  saveUsername: (options: {
    username: string | undefined;
    previousUsername: string | undefined;
  }) => unknown;
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

function getUsernameInvalidKey(
  username: string | undefined
): { key: string; replacements?: ReplacementValuesType } | undefined {
  if (!username) {
    return undefined;
  }

  if (username.length < MIN_USERNAME) {
    return {
      key: 'ProfileEditor--username--check-character-min',
      replacements: { min: MIN_USERNAME },
    };
  }

  if (!/^[0-9a-z_]+$/.test(username)) {
    return { key: 'ProfileEditor--username--check-characters' };
  }
  if (!/^[a-z_]/.test(username)) {
    return { key: 'ProfileEditor--username--check-starting-character' };
  }

  if (username.length > MAX_USERNAME) {
    return {
      key: 'ProfileEditor--username--check-character-max',
      replacements: { max: MAX_USERNAME },
    };
  }

  return undefined;
}

function mapSaveStateToEditState({
  clearUsernameSave,
  i18n,
  setEditState,
  setUsernameEditState,
  setUsernameError,
  usernameSaveState,
}: {
  clearUsernameSave: () => unknown;
  i18n: LocalizerType;
  setEditState: (state: EditState) => unknown;
  setUsernameEditState: (state: UsernameEditState) => unknown;
  setUsernameError: (errorText: string) => unknown;
  usernameSaveState: UsernameSaveState;
}): void {
  if (usernameSaveState === UsernameSaveState.None) {
    return;
  }
  if (usernameSaveState === UsernameSaveState.Saving) {
    setUsernameEditState(UsernameEditState.Saving);
    return;
  }

  clearUsernameSave();

  if (usernameSaveState === UsernameSaveState.Success) {
    setEditState(EditState.None);
    setUsernameEditState(UsernameEditState.Editing);

    return;
  }

  if (usernameSaveState === UsernameSaveState.UsernameMalformedError) {
    setUsernameEditState(UsernameEditState.Editing);
    setUsernameError(i18n('ProfileEditor--username--check-characters'));
    return;
  }
  if (usernameSaveState === UsernameSaveState.UsernameTakenError) {
    setUsernameEditState(UsernameEditState.Editing);
    setUsernameError(i18n('ProfileEditor--username--check-username-taken'));
    return;
  }
  if (usernameSaveState === UsernameSaveState.GeneralError) {
    setUsernameEditState(UsernameEditState.ShowingErrorPopup);
    return;
  }
  if (usernameSaveState === UsernameSaveState.DeleteFailed) {
    setUsernameEditState(UsernameEditState.Editing);
    return;
  }

  const state: never = usernameSaveState;
  log.error(
    `ProfileEditor: useEffect username didn't handle usernameSaveState '${state})'`
  );
  setEditState(EditState.None);
}

export const ProfileEditor = ({
  aboutEmoji,
  aboutText,
  profileAvatarPath,
  clearUsernameSave,
  color,
  conversationId,
  deleteAvatarFromDisk,
  familyName,
  firstName,
  i18n,
  isUsernameFlagEnabled,
  onEditStateChanged,
  onProfileChanged,
  onSetSkinTone,
  recentEmojis,
  replaceAvatar,
  saveAvatarToDisk,
  saveUsername,
  skinTone,
  userAvatarData,
  username,
  usernameSaveState,
}: PropsType): JSX.Element => {
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
  const [newUsername, setNewUsername] = useState<string | undefined>(username);
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [usernameEditState, setUsernameEditState] = useState<UsernameEditState>(
    UsernameEditState.Editing
  );

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

  // If there's some in-process username save, or just an unacknowledged save
  //   completion/error, we clear it out on mount, and then again on unmount.
  useEffect(() => {
    clearUsernameSave();

    return () => {
      clearUsernameSave();
    };
  });

  useEffect(() => {
    mapSaveStateToEditState({
      clearUsernameSave,
      i18n,
      setEditState,
      setUsernameEditState,
      setUsernameError,
      usernameSaveState,
    });
  }, [
    clearUsernameSave,
    i18n,
    setEditState,
    setUsernameEditState,
    setUsernameError,
    usernameSaveState,
  ]);

  useEffect(() => {
    // Whenever the user makes a change, we'll get rid of the red error text
    setUsernameError(undefined);

    // And then we'll check the validity of that new username
    const timeout = setTimeout(() => {
      const key = getUsernameInvalidKey(newUsername);
      if (key) {
        setUsernameError(i18n(key.key, key.replacements));
      }
    }, 1000);
    return () => {
      clearTimeout(timeout);
    };
  }, [newUsername, i18n, setUsernameError]);

  const isCurrentlySaving = usernameEditState === UsernameEditState.Saving;
  const shouldDisableUsernameSave = Boolean(
    newUsername === username ||
      !newUsername ||
      usernameError ||
      isCurrentlySaving
  );

  const checkThenSaveUsername = () => {
    if (isCurrentlySaving) {
      log.error('checkThenSaveUsername: Already saving! Returning early');
      return;
    }

    if (shouldDisableUsernameSave) {
      return;
    }

    const invalidKey = getUsernameInvalidKey(newUsername);
    if (invalidKey) {
      setUsernameError(i18n(invalidKey.key, invalidKey.replacements));
      return;
    }

    setUsernameError(undefined);
    setUsernameEditState(UsernameEditState.Saving);
    saveUsername({ username: newUsername, previousUsername: username });
  };

  const deleteUsername = () => {
    if (isCurrentlySaving) {
      log.error('deleteUsername: Already saving! Returning early');
      return;
    }

    setNewUsername(undefined);
    setUsernameError(undefined);
    setUsernameEditState(UsernameEditState.Saving);
    saveUsername({ username: undefined, previousUsername: username });
  };

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
            label={i18n(defaultBio.i18nLabel)}
            onClick={() => {
              const emojiData = getEmojiData(defaultBio.shortName, skinTone);

              setStagedProfile(profileData => ({
                ...profileData,
                aboutEmoji: unifiedToEmoji(emojiData.unified),
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
    content = (
      <>
        <Input
          i18n={i18n}
          disabled={isCurrentlySaving}
          disableSpellcheck
          onChange={changedUsername => {
            setUsernameError(undefined);
            setNewUsername(changedUsername);
          }}
          onEnter={checkThenSaveUsername}
          placeholder={i18n('ProfileEditor--username--placeholder')}
          ref={focusInputRef}
          value={newUsername}
        />

        {usernameError && (
          <div className="ProfileEditor__error">{usernameError}</div>
        )}
        <div
          className={classNames(
            'ProfileEditor__info',
            !usernameError ? 'ProfileEditor__info--no-error' : undefined
          )}
        >
          <Intl i18n={i18n} id="ProfileEditor--username--helper" />
        </div>

        <Modal.ButtonFooter>
          <Button
            disabled={isCurrentlySaving}
            onClick={() => {
              const handleCancel = () => {
                handleBack();
                setNewUsername(username);
              };

              const hasChanges = newUsername !== username;
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
            disabled={shouldDisableUsernameSave}
            onClick={checkThenSaveUsername}
          >
            {isCurrentlySaving ? (
              <Spinner size="20px" svgSize="small" direction="on-avatar" />
            ) : (
              i18n('save')
            )}
          </Button>
        </Modal.ButtonFooter>
      </>
    );
  } else if (editState === EditState.None) {
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
        {isUsernameFlagEnabled ? (
          <PanelRow
            className="ProfileEditor__row"
            icon={
              <i className="ProfileEditor__icon--container ProfileEditor__icon ProfileEditor__icon--username" />
            }
            label={username || i18n('ProfileEditor--username')}
            onClick={
              usernameEditState !== UsernameEditState.Saving
                ? () => {
                    setNewUsername(username);
                    setEditState(EditState.Username);
                  }
                : undefined
            }
            actions={
              username ? (
                <ConversationDetailsIcon
                  ariaLabel={i18n('ProfileEditor--username--delete-username')}
                  icon={
                    usernameEditState === UsernameEditState.Saving
                      ? IconType.spinner
                      : IconType.trash
                  }
                  disabled={usernameEditState === UsernameEditState.Saving}
                  fakeButton
                  onClick={() => {
                    setUsernameEditState(UsernameEditState.ConfirmingDelete);
                  }}
                />
              ) : null
            }
          />
        ) : null}
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
            id="ProfileEditor--info"
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
      {usernameEditState === UsernameEditState.ShowingErrorPopup && (
        <ConfirmationDialog
          cancelText={i18n('ok')}
          cancelButtonVariant={ButtonVariant.Secondary}
          i18n={i18n}
          onClose={() => setUsernameEditState(UsernameEditState.Editing)}
        >
          {i18n('ProfileEditor--username--general-error')}
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
};
