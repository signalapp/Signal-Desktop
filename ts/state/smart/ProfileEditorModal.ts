// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { get } from 'lodash';
import { mapDispatchToProps } from '../actions';
import {
  ProfileEditorModal,
  PropsDataType as ProfileEditorModalPropsType,
} from '../../components/ProfileEditorModal';
import { PropsDataType } from '../../components/ProfileEditor';
import { StateType } from '../reducer';
import { getIntl } from '../selectors/user';
import { getMe } from '../selectors/conversations';
import { selectRecentEmojis } from '../selectors/emojis';

function mapStateToProps(
  state: StateType
): PropsDataType & ProfileEditorModalPropsType {
  const { avatarPath, aboutText, aboutEmoji, firstName, familyName } = getMe(
    state
  );
  const recentEmojis = selectRecentEmojis(state);
  const skinTone = get(state, ['items', 'skinTone'], 0);

  return {
    aboutEmoji,
    aboutText,
    avatarPath,
    familyName,
    firstName: String(firstName),
    hasError: state.globalModals.profileEditorHasError,
    i18n: getIntl(state),
    recentEmojis,
    skinTone,
  };
}

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartProfileEditorModal = smart(ProfileEditorModal);
