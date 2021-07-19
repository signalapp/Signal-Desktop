// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as grapheme from '../util/grapheme';

import { AvatarInputContainer } from './AvatarInputContainer';
import { AvatarInputType } from './AvatarInput';
import { Button, ButtonVariant } from './Button';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Emoji } from './emoji/Emoji';
import { EmojiButton, Props as EmojiButtonProps } from './emoji/EmojiButton';
import { EmojiPickDataType } from './emoji/EmojiPicker';
import { Input } from './Input';
import { Intl } from './Intl';
import { LocalizerType } from '../types/Util';
import { PanelRow } from './conversation/conversation-details/PanelRow';
import { ProfileDataType } from '../state/ducks/conversations';
import { getEmojiData, unifiedToEmoji } from './emoji/lib';
import { missingCaseError } from '../util/missingCaseError';

export enum EditState {
  None = 'None',
  ProfileName = 'ProfileName',
  Bio = 'Bio',
}

type PropsExternalType = {
  onEditStateChanged: (editState: EditState) => unknown;
  onProfileChanged: (
    profileData: ProfileDataType,
    avatarData?: ArrayBuffer
  ) => unknown;
};

export type PropsDataType = {
  aboutEmoji?: string;
  aboutText?: string;
  avatarPath?: string;
  familyName?: string;
  firstName: string;
  i18n: LocalizerType;
} & Pick<EmojiButtonProps, 'recentEmojis' | 'skinTone'>;

type PropsActionType = {
  onSetSkinTone: (tone: number) => unknown;
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

export const ProfileEditor = ({
  aboutEmoji,
  aboutText,
  avatarPath,
  familyName,
  firstName,
  i18n,
  onEditStateChanged,
  onProfileChanged,
  onSetSkinTone,
  recentEmojis,
  skinTone,
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

  const [avatarData, setAvatarData] = useState<ArrayBuffer | undefined>(
    undefined
  );
  const [stagedProfile, setStagedProfile] = useState<ProfileDataType>({
    aboutEmoji,
    aboutText,
    familyName,
    firstName,
  });

  let content: JSX.Element;

  const handleBack = useCallback(() => {
    setEditState(EditState.None);
    onEditStateChanged(EditState.None);
  }, [setEditState, onEditStateChanged]);

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

  const handleAvatarChanged = useCallback(
    (avatar: ArrayBuffer | undefined) => {
      setAvatarData(avatar);
    },
    [setAvatarData]
  );

  const calculateGraphemeCount = useCallback((name = '') => {
    return 256 - grapheme.count(name);
  }, []);

  useEffect(() => {
    const focusNode = focusInputRef.current;
    if (!focusNode) {
      return;
    }

    focusNode.focus();
  }, [editState]);

  if (editState === EditState.ProfileName) {
    content = (
      <>
        <Input
          i18n={i18n}
          maxGraphemeCount={calculateGraphemeCount(stagedProfile.familyName)}
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
          maxGraphemeCount={calculateGraphemeCount(stagedProfile.firstName)}
          onChange={newFamilyName => {
            setStagedProfile(profileData => ({
              ...profileData,
              familyName: newFamilyName,
            }));
          }}
          placeholder={i18n('ProfileEditor--last-name')}
          value={stagedProfile.familyName}
        />
        <div className="ProfileEditor__buttons">
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
            disabled={!stagedProfile.firstName}
            onClick={() => {
              if (!stagedProfile.firstName) {
                return;
              }
              setFullName({
                firstName,
                familyName,
              });

              onProfileChanged(stagedProfile, avatarData);
              handleBack();
            }}
          >
            {i18n('save')}
          </Button>
        </div>
      </>
    );
  } else if (editState === EditState.Bio) {
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
          maxGraphemeCount={140}
          moduleClassName="ProfileEditor__about-input"
          onChange={value => {
            if (value) {
              setStagedProfile(profileData => ({
                ...profileData,
                aboutEmoji: stagedProfile.aboutEmoji,
                aboutText: value,
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

        <div className="ProfileEditor__buttons">
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
            onClick={() => {
              setFullBio({
                aboutEmoji: stagedProfile.aboutEmoji,
                aboutText: stagedProfile.aboutText,
              });

              onProfileChanged(stagedProfile, avatarData);
              handleBack();
            }}
          >
            {i18n('save')}
          </Button>
        </div>
      </>
    );
  } else if (editState === EditState.None) {
    const fullNameText = [fullName.firstName, fullName.familyName]
      .filter(Boolean)
      .join(' ');

    content = (
      <>
        <AvatarInputContainer
          avatarPath={avatarPath}
          contextMenuId="edit-self-profile-avatar"
          i18n={i18n}
          onAvatarChanged={avatar => {
            handleAvatarChanged(avatar);
            onProfileChanged(stagedProfile, avatar);
          }}
          onAvatarLoaded={handleAvatarChanged}
          type={AvatarInputType.Profile}
        />

        <hr className="ProfileEditor__divider" />

        <PanelRow
          className="ProfileEditor__row"
          icon={
            <i className="ProfileEditor__icon--container ProfileEditor__icon ProfileEditor__icon--name" />
          }
          label={fullNameText}
          onClick={() => {
            setEditState(EditState.ProfileName);
            onEditStateChanged(EditState.ProfileName);
          }}
        />

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
          label={fullBio.aboutText || i18n('ProfileEditor--about')}
          onClick={() => {
            setEditState(EditState.Bio);
            onEditStateChanged(EditState.Bio);
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
      {confirmDiscardAction && (
        <ConfirmationDialog
          actions={[
            {
              action: confirmDiscardAction,
              text: i18n('discard'),
              style: 'negative',
            },
          ]}
          i18n={i18n}
          onClose={() => setConfirmDiscardAction(undefined)}
        >
          {i18n('ProfileEditor--discard')}
        </ConfirmationDialog>
      )}
      <div className="ProfileEditor">{content}</div>
    </>
  );
};
