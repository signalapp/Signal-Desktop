// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import type { PropsDataType as ProfileEditorModalPropsType } from '../../components/ProfileEditorModal';
import { ProfileEditorModal } from '../../components/ProfileEditorModal';
import type { PropsDataType } from '../../components/ProfileEditor';
import { SmartEditUsernameModalBody } from './EditUsernameModalBody';
import type { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import {
  getEmojiSkinTone,
  getHasCompletedUsernameLinkOnboarding,
  getUsernameCorrupted,
  getUsernameLinkColor,
  getUsernameLink,
  getUsernameLinkCorrupted,
  isInternalUser,
} from '../selectors/items';
import { getMe } from '../selectors/conversations';
import { selectRecentEmojis } from '../selectors/emojis';
import {
  getUsernameEditState,
  getUsernameLinkState,
} from '../selectors/username';

function renderEditUsernameModalBody(props: {
  isRootModal: boolean;
  onClose: () => void;
}): JSX.Element {
  return <SmartEditUsernameModalBody {...props} />;
}

function mapStateToProps(
  state: StateType
): Omit<PropsDataType, 'onEditStateChange' | 'onProfileChanged'> &
  ProfileEditorModalPropsType {
  const {
    profileAvatarPath,
    avatars: userAvatarData = [],
    aboutText,
    aboutEmoji,
    color,
    firstName,
    familyName,
    id: conversationId,
    username,
  } = getMe(state);
  const recentEmojis = selectRecentEmojis(state);
  const skinTone = getEmojiSkinTone(state);
  const hasCompletedUsernameLinkOnboarding =
    getHasCompletedUsernameLinkOnboarding(state);
  const usernameEditState = getUsernameEditState(state);
  const usernameLinkState = getUsernameLinkState(state);
  const usernameLinkColor = getUsernameLinkColor(state);
  const usernameLink = getUsernameLink(state);
  const usernameCorrupted = getUsernameCorrupted(state);
  const usernameLinkCorrupted = getUsernameLinkCorrupted(state);

  return {
    aboutEmoji,
    aboutText,
    profileAvatarPath,
    color,
    conversationId,
    familyName,
    firstName: String(firstName),
    hasCompletedUsernameLinkOnboarding,
    hasError: state.globalModals.profileEditorHasError,
    initialEditState: state.globalModals.profileEditorInitialEditState,
    i18n: getIntl(state),
    recentEmojis,
    skinTone,
    userAvatarData,
    username,
    usernameCorrupted,
    usernameEditState,
    usernameLinkState,
    usernameLinkColor,
    usernameLinkCorrupted,
    usernameLink,
    isUsernameDeletionEnabled: isInternalUser(state),

    renderEditUsernameModalBody,
  };
}

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartProfileEditorModal = smart(ProfileEditorModal);
