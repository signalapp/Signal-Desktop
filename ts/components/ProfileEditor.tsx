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
import type {
  ProfileDataType,
  SaveAttachmentActionCreatorType,
} from '../state/ducks/conversations';
import { UsernameEditState } from '../state/ducks/usernameEnums';
import type { UsernameLinkState } from '../state/ducks/usernameEnums';
import { ToastType } from '../types/Toast';
import type { ShowToastAction } from '../state/ducks/toast';
import { getEmojiData, unifiedToEmoji } from './emoji/lib';
import { assertDev } from '../util/assert';
import { missingCaseError } from '../util/missingCaseError';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenu } from './ContextMenu';
import { UsernameLinkModalBody } from './UsernameLinkModalBody';
import {
  ConversationDetailsIcon,
  IconType,
} from './conversation/conversation-details/ConversationDetailsIcon';
import { isWhitespace, trim } from '../util/whitespaceStringUtil';
import { UserText } from './UserText';
import { Tooltip, TooltipPlacement } from './Tooltip';

export enum EditState {
  None = 'None',
  BetterAvatar = 'BetterAvatar',
  ProfileName = 'ProfileName',
  Bio = 'Bio',
  Username = 'Username',
  UsernameLink = 'UsernameLink',
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
  hasCompletedUsernameLinkOnboarding: boolean;
  i18n: LocalizerType;
  isUsernameFlagEnabled: boolean;
  phoneNumber?: string;
  userAvatarData: ReadonlyArray<AvatarDataType>;
  username?: string;
  initialEditState?: EditState;
  usernameCorrupted: boolean;
  usernameEditState: UsernameEditState;
  usernameLinkState: UsernameLinkState;
  usernameLinkColor?: number;
  usernameLink?: string;
  usernameLinkCorrupted: boolean;
} & Pick<EmojiButtonProps, 'recentEmojis' | 'skinTone'>;

type PropsActionType = {
  deleteAvatarFromDisk: DeleteAvatarFromDiskActionType;
  markCompletedUsernameLinkOnboarding: () => void;
  onSetSkinTone: (tone: number) => unknown;
  replaceAvatar: ReplaceAvatarActionType;
  saveAttachment: SaveAttachmentActionCreatorType;
  saveAvatarToDisk: SaveAvatarToDiskActionType;
  setUsernameEditState: (editState: UsernameEditState) => void;
  setUsernameLinkColor: (color: number) => void;
  resetUsernameLink: () => void;
  deleteUsername: () => void;
  showToast: ShowToastAction;
  openUsernameReservationModal: () => void;
};

export type PropsType = PropsDataType & PropsActionType & PropsExternalType;

type DefaultBio = {
  i18nLabel: string;
  shortName: string;
};

function getDefaultBios(i18n: LocalizerType): Array<DefaultBio> {
  return [
    {
      i18nLabel: i18n('icu:Bio--speak-freely'),
      shortName: 'wave',
    },
    {
      i18nLabel: i18n('icu:Bio--encrypted'),
      shortName: 'zipper_mouth_face',
    },
    {
      i18nLabel: i18n('icu:Bio--free-to-chat'),
      shortName: '+1',
    },
    {
      i18nLabel: i18n('icu:Bio--coffee-lover'),
      shortName: 'coffee',
    },
    {
      i18nLabel: i18n('icu:Bio--taking-break'),
      shortName: 'mobile_phone_off',
    },
  ];
}

export function ProfileEditor({
  aboutEmoji,
  aboutText,
  color,
  conversationId,
  deleteAvatarFromDisk,
  deleteUsername,
  familyName,
  firstName,
  hasCompletedUsernameLinkOnboarding,
  i18n,
  initialEditState = EditState.None,
  isUsernameFlagEnabled,
  markCompletedUsernameLinkOnboarding,
  onEditStateChanged,
  onProfileChanged,
  onSetSkinTone,
  openUsernameReservationModal,
  phoneNumber,
  profileAvatarPath,
  recentEmojis,
  renderEditUsernameModalBody,
  replaceAvatar,
  resetUsernameLink,
  saveAttachment,
  saveAvatarToDisk,
  setUsernameEditState,
  setUsernameLinkColor,
  showToast,
  skinTone,
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
  const [editState, setEditState] = useState<EditState>(initialEditState);
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
  const [isResettingUsername, setIsResettingUsername] = useState(false);

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
          placeholder={i18n('icu:ProfileEditor--first-name')}
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
          placeholder={i18n('icu:ProfileEditor--last-name')}
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
            {i18n('icu:cancel')}
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
            {i18n('icu:save')}
          </Button>
        </Modal.ButtonFooter>
      </>
    );
  } else if (editState === EditState.Bio) {
    const shouldDisableSave =
      isLoadingAvatar ||
      (stagedProfile.aboutText === fullBio.aboutText &&
        stagedProfile.aboutEmoji === fullBio.aboutEmoji);

    const defaultBios = getDefaultBios(i18n);

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
          placeholder={i18n('icu:ProfileEditor--about-placeholder')}
          value={stagedProfile.aboutText}
          whenToShowRemainingCount={40}
        />

        {defaultBios.map(defaultBio => (
          <PanelRow
            className="ProfileEditor__row"
            key={defaultBio.shortName}
            icon={
              <div className="ProfileEditor__icon--container">
                <Emoji shortName={defaultBio.shortName} size={24} />
              </div>
            }
            label={defaultBio.i18nLabel}
            onClick={() => {
              const emojiData = getEmojiData(defaultBio.shortName, skinTone);

              setStagedProfile(profileData => ({
                ...profileData,
                aboutEmoji: unifiedToEmoji(emojiData.unified),
                aboutText: defaultBio.i18nLabel,
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
            {i18n('icu:cancel')}
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
            {i18n('icu:save')}
          </Button>
        </Modal.ButtonFooter>
      </>
    );
  } else if (editState === EditState.Username) {
    content = renderEditUsernameModalBody({
      onClose: () => setEditState(EditState.None),
    });
  } else if (editState === EditState.UsernameLink) {
    content = (
      <UsernameLinkModalBody
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
        onBack={() => setEditState(EditState.None)}
      />
    );
  } else if (editState === EditState.None) {
    let maybeUsernameRows: JSX.Element | undefined;
    if (isUsernameFlagEnabled) {
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
              setEditState(EditState.UsernameLink);
            }}
            alwaysShowActions
            actions={linkActions}
          />
        );

        if (!hasCompletedUsernameLinkOnboarding) {
          const tooltip = (
            <div className="ProfileEditor__username-link__tooltip__container">
              <div className="ProfileEditor__username-link__tooltip__icon" />

              <div className="ProfileEditor__username-link__tooltip__content">
                <h3>
                  {i18n('icu:ProfileEditor__username-link__tooltip__title')}
                </h3>
                <p>{i18n('icu:ProfileEditor__username-link__tooltip__body')}</p>
              </div>

              <button
                type="button"
                className="ProfileEditor__username-link__tooltip__close"
                onClick={markCompletedUsernameLinkOnboarding}
                aria-label={i18n('icu:close')}
              />
            </div>
          );
          maybeUsernameLinkRow = (
            <Tooltip
              className="ProfileEditor__username-link__tooltip"
              direction={TooltipPlacement.Bottom}
              sticky
              content={tooltip}
            >
              {maybeUsernameLinkRow}
            </Tooltip>
          );
        }
      }

      maybeUsernameRows = (
        <>
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
              setEditState(EditState.Username);
            }}
            alwaysShowActions={alwaysShowActions}
            actions={actions}
          />
          {maybeUsernameLinkRow}
        </>
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
        <h1 className="ProfileEditor__Title">{getFullNameText()}</h1>
        {phoneNumber != null && (
          <p className="ProfileEditor__PhoneNumber">{phoneNumber}</p>
        )}
        <hr className="ProfileEditor__divider" />
        <PanelRow
          className="ProfileEditor__row"
          icon={
            <i className="ProfileEditor__icon--container ProfileEditor__icon ProfileEditor__icon--name" />
          }
          label={<UserText text={getFullNameText()} />}
          onClick={() => {
            setEditState(EditState.ProfileName);
          }}
        />
        {maybeUsernameRows}
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
            <UserText
              text={fullBio.aboutText || i18n('icu:ProfileEditor--about')}
            />
          }
          onClick={() => {
            setEditState(EditState.Bio);
          }}
        />
        <hr className="ProfileEditor__divider" />
        <div className="ProfileEditor__info">
          <Intl
            i18n={i18n}
            id="icu:ProfileEditor--info--link"
            components={{
              // This is a render prop, not a component
              // eslint-disable-next-line react/no-unstable-nested-components
              learnMoreLink: parts => (
                <a
                  href="https://support.signal.org/hc/en-us/articles/360007459591"
                  target="_blank"
                  rel="noreferrer"
                >
                  {parts}
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
              text: i18n('icu:ProfileEditor--username--confirm-delete-button'),
              style: 'negative',
              action: () => deleteUsername(),
            },
          ]}
        >
          {i18n('icu:ProfileEditor--username--confirm-delete-body-2', {
            username,
          })}
        </ConfirmationDialog>
      )}

      {confirmDiscardAction && (
        <ConfirmDiscardDialog
          i18n={i18n}
          onDiscard={confirmDiscardAction}
          onClose={() => setConfirmDiscardAction(undefined)}
        />
      )}

      {isResettingUsername && (
        <ConfirmationDialog
          dialogName="ProfileEditor.confirmResetUsername"
          moduleClassName="ProfileEditor__reset-username-modal"
          i18n={i18n}
          onClose={() => setIsResettingUsername(false)}
          actions={[
            {
              text: i18n(
                'icu:ProfileEditor--username--corrupted--delete-button'
              ),
              action: () => deleteUsername(),
            },
            {
              text: i18n(
                'icu:ProfileEditor--username--corrupted--create-button'
              ),
              style: 'affirmative',
              action: () => {
                openUsernameReservationModal();
                setEditState(EditState.Username);
              },
            },
          ]}
        >
          {i18n('icu:ProfileEditor--username--corrupted--body')}
        </ConfirmationDialog>
      )}

      <div className="ProfileEditor">{content}</div>
    </>
  );
}
