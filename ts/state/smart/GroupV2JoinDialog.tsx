// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import type { PropsType as GroupV2JoinDialogPropsType } from '../../components/GroupV2JoinDialog';
import { GroupV2JoinDialog } from '../../components/GroupV2JoinDialog';
import type { StateType } from '../reducer';

import { getIntl } from '../selectors/user';
import { getPreJoinConversation } from '../selectors/conversations';

export type PropsType = Pick<GroupV2JoinDialogPropsType, 'join' | 'onClose'>;

const mapStateToProps = (
  state: StateType,
  props: PropsType
): GroupV2JoinDialogPropsType => {
  const preJoinConversation = getPreJoinConversation(state);

  if (!preJoinConversation) {
    throw new Error('smart/GroupV2JoinDialog: No pre-join conversation!');
  }

  return {
    ...props,
    ...preJoinConversation,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartGroupV2JoinDialog = smart(GroupV2JoinDialog);
