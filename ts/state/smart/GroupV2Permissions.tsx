// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import type { StateType } from '../reducer';
import type { PropsDataType } from '../../components/conversation/conversation-details/GroupV2Permissions';
import { mapDispatchToProps } from '../actions';
import { GroupV2Permissions } from '../../components/conversation/conversation-details/GroupV2Permissions';
import { getConversationSelector } from '../selectors/conversations';
import { getIntl } from '../selectors/user';

export type SmartGroupV2PermissionsProps = {
  conversationId: string;
};

const mapStateToProps = (
  state: StateType,
  props: SmartGroupV2PermissionsProps
): PropsDataType => {
  const conversation = getConversationSelector(state)(props.conversationId);

  return {
    ...props,
    conversation,
    i18n: getIntl(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartGroupV2Permissions = smart(GroupV2Permissions);
