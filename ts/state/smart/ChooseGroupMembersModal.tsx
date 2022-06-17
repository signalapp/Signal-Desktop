// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { connect } from 'react-redux';

import type { StateType } from '../reducer';
import { mapDispatchToProps } from '../actions';
import { strictAssert } from '../../util/assert';
import { lookupConversationWithoutUuid } from '../../util/lookupConversationWithoutUuid';

import type { StatePropsType } from '../../components/conversation/conversation-details/AddGroupMembersModal/ChooseGroupMembersModal';
import { ChooseGroupMembersModal } from '../../components/conversation/conversation-details/AddGroupMembersModal/ChooseGroupMembersModal';

import { getIntl, getTheme, getRegionCode } from '../selectors/user';
import { getUsernamesEnabled } from '../selectors/items';
import {
  getCandidateContactsForNewGroup,
  getConversationByIdSelector,
} from '../selectors/conversations';
import { getPreferredBadgeSelector } from '../selectors/badges';

export type SmartChooseGroupMembersModalPropsType = {
  conversationIdsAlreadyInGroup: Set<string>;
  maxGroupSize: number;
  confirmAdds: () => void;
  onClose: () => void;
  removeSelectedContact: (_: string) => void;
  searchTerm: string;
  selectedConversationIds: ReadonlyArray<string>;
  setSearchTerm: (_: string) => void;
  toggleSelectedContact: (conversationId: string) => void;
};

const mapStateToProps = (
  state: StateType,
  props: SmartChooseGroupMembersModalPropsType
): StatePropsType => {
  const conversationSelector = getConversationByIdSelector(state);

  const candidateContacts = getCandidateContactsForNewGroup(state);
  const selectedContacts = props.selectedConversationIds.map(conversationId => {
    const convo = conversationSelector(conversationId);
    strictAssert(
      convo,
      '<SmartChooseGroupMemberModal> selected conversation not found'
    );
    return convo;
  });

  return {
    ...props,
    regionCode: getRegionCode(state),
    candidateContacts,
    getPreferredBadge: getPreferredBadgeSelector(state),
    i18n: getIntl(state),
    theme: getTheme(state),
    selectedContacts,
    lookupConversationWithoutUuid,
    isUsernamesEnabled: getUsernamesEnabled(state),
  };
};

const smart = connect(mapStateToProps, mapDispatchToProps);

export const SmartChooseGroupMembersModal = smart(ChooseGroupMembersModal);
