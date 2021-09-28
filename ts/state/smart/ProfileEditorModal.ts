// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import {
  ProfileEditorModal,
  PropsDataType as ProfileEditorModalPropsType,
} from '../../components/ProfileEditorModal';
import { PropsDataType } from '../../components/ProfileEditor';
import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { getEmojiSkinTone } from '../selectors/items';
import { getMe } from '../selectors/conversations';
import { selectRecentEmojis } from '../selectors/emojis';

function mapStateToProps(
  state: StateType
): Omit<PropsDataType, 'onEditStateChange' | 'onProfileChanged'> &
  ProfileEditorModalPropsType {
  const {
    avatarPath,
    avatars: userAvatarData = [],
    aboutText,
    aboutEmoji,
    color,
    firstName,
    familyName,
    id: conversationId,
  } = getMe(state);
  const recentEmojis = selectRecentEmojis(state);
  const skinTone = getEmojiSkinTone(state);

  return {
    aboutEmoji,
    aboutText,
    avatarPath,
    color,
    conversationId,
    familyName,
    firstName: String(firstName),
    hasError: state.globalModals.profileEditorHasError,
    i18n: getIntl(state),
    recentEmojis,
    skinTone,
    userAvatarData,
  };
}

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartProfileEditorModal = smart(ProfileEditorModal);
