// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { AddUserToAnotherGroupModal } from '../../components/AddUserToAnotherGroupModal';
import type { StateType } from '../reducer';
import {
  getAllGroupsWithInviteAccess,
  getContactSelector,
} from '../selectors/conversations';
import { getIntl, getRegionCode, getTheme } from '../selectors/user';

export type Props = {
  contactID: string;
};

const mapStateToProps = (state: StateType, props: Props) => {
  const candidateConversations = getAllGroupsWithInviteAccess(state);
  const getContact = getContactSelector(state);

  const regionCode = getRegionCode(state);

  return {
    contact: getContact(props.contactID),
    i18n: getIntl(state),
    theme: getTheme(state),
    candidateConversations,
    regionCode,
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartAddUserToAnotherGroupModal = smart(
  AddUserToAnotherGroupModal
);
