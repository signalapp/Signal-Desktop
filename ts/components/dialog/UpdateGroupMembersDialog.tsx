import React from 'react';
import _ from 'lodash';
import { useDispatch } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { ToastUtils, UserUtils } from '../../session/utils';

import { SpacerLG, Text } from '../basic/Text';
import { updateGroupMembersModal } from '../../state/ducks/modalDialog';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { MemberListItem } from '../MemberListItem';
import { SessionWrapperModal } from '../SessionWrapperModal';

import { useConversationPropsById, useWeAreAdmin } from '../../hooks/useParamSelector';

import { useSet } from '../../hooks/useSet';
import { getConversationController } from '../../session/conversations';
import { initiateClosedGroupUpdate } from '../../session/group/closed-group';

type Props = {
  conversationId: string;
};

const StyledClassicMemberList = styled.div`
  max-height: 240px;
`;

/**
 * Admins are always put first in the list of group members.
 * Also, admins have a little crown on their avatar.
 */
const ClassicMemberList = (props: {
  convoId: string;
  selectedMembers: Array<string>;
  onSelect: (m: string) => void;
  onUnselect: (m: string) => void;
}) => {
  const { onSelect, convoId, onUnselect, selectedMembers } = props;
  const weAreAdmin = useWeAreAdmin(convoId);
  const convoProps = useConversationPropsById(convoId);
  if (!convoProps) {
    throw new Error('MemberList needs convoProps');
  }
  let currentMembers = convoProps.members || [];
  const { groupAdmins } = convoProps;
  currentMembers = [...currentMembers].sort(m => (groupAdmins?.includes(m) ? -1 : 0));

  return (
    <>
      {currentMembers.map(member => {
        const isSelected = (weAreAdmin && selectedMembers.includes(member)) || false;
        const isAdmin = groupAdmins?.includes(member);

        return (
          <MemberListItem
            pubkey={member}
            isSelected={isSelected}
            onSelect={onSelect}
            onUnselect={onUnselect}
            key={member}
            isAdmin={isAdmin}
            disableBg={true}
          />
        );
      })}
    </>
  );
};

const ZombiesList = ({ convoId }: { convoId: string }) => {
  const convoProps = useConversationPropsById(convoId);

  function onZombieClicked() {
    if (!convoProps?.weAreAdmin) {
      ToastUtils.pushOnlyAdminCanRemove();
    }
  }
  if (!convoProps || !convoProps.zombies?.length) {
    return null;
  }
  const { zombies, weAreAdmin } = convoProps;

  const zombieElements = zombies.map((zombie: string) => {
    const isSelected = weAreAdmin || false; // && !member.checkmarked;
    return (
      <MemberListItem
        isSelected={isSelected}
        onSelect={onZombieClicked}
        onUnselect={onZombieClicked}
        isZombie={true}
        key={zombie}
        pubkey={zombie}
      />
    );
  });
  return (
    <>
      <SpacerLG />
      {weAreAdmin && (
        <Text
          padding="20px"
          text={window.i18n('removeResidueMembers')}
          subtle={true}
          maxWidth="400px"
          textAlign="center"
        />
      )}
      {zombieElements}
    </>
  );
};

async function onSubmit(convoId: string, membersAfterUpdate: Array<string>) {
  const convoFound = getConversationController().get(convoId);
  if (!convoFound || !convoFound.isGroup()) {
    throw new Error('Invalid convo for updateGroupMembersDialog');
  }
  if (!convoFound.isAdmin(UserUtils.getOurPubKeyStrFromCache())) {
    window.log.warn('Skipping update of members, we are not the admin');
    return;
  }
  const ourPK = UserUtils.getOurPubKeyStrFromCache();

  const allMembersAfterUpdate = _.uniq(_.concat(membersAfterUpdate, [ourPK]));

  // membersAfterUpdate won't include the zombies. We are the admin and we want to remove them not matter what

  // We need to NOT trigger an group update if the list of member is the same.
  // We need to merge all members, including zombies for this call.
  // We consider that the admin ALWAYS wants to remove zombies (actually they should be removed
  // automatically by him when the LEFT message is received)

  const existingMembers = convoFound.get('members') || [];
  const existingZombies = convoFound.get('zombies') || [];

  const allExistingMembersWithZombies = _.uniq(existingMembers.concat(existingZombies));

  const notPresentInOld = allMembersAfterUpdate.filter(
    m => !allExistingMembersWithZombies.includes(m)
  );

  // be sure to include zombies in here
  const membersToRemove = allExistingMembersWithZombies.filter(
    m => !allMembersAfterUpdate.includes(m)
  );

  // do the xor between the two. if the length is 0, it means the before and the after is the same.
  const xor = _.xor(membersToRemove, notPresentInOld);
  if (xor.length === 0) {
    window.log.info('skipping group update: no detected changes in group member list');

    return;
  }

  // If any extra devices of removed exist in newMembers, ensure that you filter them
  // Note: I think this is useless
  const filteredMembers = allMembersAfterUpdate.filter(
    memberAfterUpdate => !_.includes(membersToRemove, memberAfterUpdate)
  );

  void initiateClosedGroupUpdate(
    convoId,
    convoFound.get('displayNameInProfile') || 'Unknown',
    filteredMembers
  );
}

export const UpdateGroupMembersDialog = (props: Props) => {
  const { conversationId } = props;
  const convoProps = useConversationPropsById(conversationId);
  const existingMembers = convoProps?.members || [];

  const {
    addTo,
    removeFrom,
    uniqueValues: membersToKeepWithUpdate,
  } = useSet<string>(existingMembers);

  const dispatch = useDispatch();

  if (!convoProps || convoProps.isPrivate || convoProps.isPublic) {
    throw new Error('UpdateGroupMembersDialog invalid convoProps');
  }

  const weAreAdmin = convoProps.weAreAdmin || false;

  const closeDialog = () => {
    dispatch(updateGroupMembersModal(null));
  };

  const onClickOK = async () => {
    // const members = getWouldBeMembers(this.state.contactList).map(d => d.id);
    // do not include zombies here, they are removed by force
    await onSubmit(conversationId, membersToKeepWithUpdate);
    closeDialog();
  };

  useKey((event: KeyboardEvent) => {
    return event.key === 'Esc' || event.key === 'Escape';
  }, closeDialog);

  const onAdd = (member: string) => {
    if (!weAreAdmin) {
      ToastUtils.pushOnlyAdminCanRemove();
      return;
    }

    addTo(member);
  };

  const onRemove = (member: string) => {
    if (!weAreAdmin) {
      window?.log?.warn('Only group admin can remove members!');

      ToastUtils.pushOnlyAdminCanRemove();
      return;
    }
    if (convoProps.groupAdmins?.includes(member)) {
      ToastUtils.pushCannotRemoveCreatorFromGroup();
      window?.log?.warn(
        `User ${member} cannot be removed as they are the creator of the closed group.`
      );
      return;
    }

    removeFrom(member);
  };

  const showNoMembersMessage = existingMembers.length === 0;
  const okText = window.i18n('ok');
  const cancelText = window.i18n('cancel');
  const titleText = window.i18n('updateGroupDialogTitle', [convoProps.displayNameInProfile || '']);

  return (
    <SessionWrapperModal title={titleText} onClose={closeDialog}>
      <StyledClassicMemberList className="group-member-list__selection">
        <ClassicMemberList
          convoId={conversationId}
          onSelect={onAdd}
          onUnselect={onRemove}
          selectedMembers={membersToKeepWithUpdate}
        />
      </StyledClassicMemberList>
      <ZombiesList convoId={conversationId} />
      {showNoMembersMessage && <p>{window.i18n('noMembersInThisGroup')}</p>}

      <SpacerLG />

      <div className="session-modal__button-group">
        {weAreAdmin && (
          <SessionButton text={okText} onClick={onClickOK} buttonType={SessionButtonType.Simple} />
        )}
        <SessionButton
          text={cancelText}
          buttonColor={weAreAdmin ? SessionButtonColor.Danger : undefined}
          buttonType={SessionButtonType.Simple}
          onClick={closeDialog}
        />
      </div>
    </SessionWrapperModal>
  );
};
