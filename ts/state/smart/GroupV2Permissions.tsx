// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import { StateType } from '../reducer';
import {
  GroupV2Permissions,
  PropsType,
} from '../../components/conversation/conversation-details/GroupV2Permissions';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';
import { AccessControlClass } from '../../textsecure.d';

export type SmartGroupV2PermissionsProps = {
  accessEnum: typeof AccessControlClass.AccessRequired;
  conversationId: string;
  setAccessControlAttributesSetting: (value: number) => void;
  setAccessControlMembersSetting: (value: number) => void;
};

const mapStateToProps = (
  state: StateType,
  props: SmartGroupV2PermissionsProps
): PropsType => {
  const conversation = getConversationSelector(state)(props.conversationId);

  return {
    ...props,
    conversation,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps);

export const SmartGroupV2Permissions = smart(GroupV2Permissions);
