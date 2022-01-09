import React from 'react';

import { getConversationController } from '../../session/conversations';
import { ToastUtils, UserUtils } from '../../session/utils';
import { ConversationTypeEnum } from '../../models/conversation';
import { getCompleteUrlForV2ConvoId } from '../../interactions/conversationInteractions';
import _ from 'lodash';
import { VALIDATION } from '../../session/constants';
import { SpacerLG } from '../basic/Text';
import { useDispatch, useSelector } from 'react-redux';
import { updateInviteContactModal } from '../../state/ducks/modalDialog';
// tslint:disable-next-line: no-submodule-imports
import useKey from 'react-use/lib/useKey';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { MemberListItem } from '../MemberListItem';
import { SessionWrapperModal } from '../SessionWrapperModal';
import { getPrivateContactsPubkeys } from '../../state/selectors/conversations';
import { useConversationPropsById } from '../../hooks/useParamSelector';
import { useSet } from '../../hooks/useSet';
import { initiateClosedGroupUpdate } from '../../session/group/closed-group';

type Props = {
  conversationId: string;
};

const submitForOpenGroup = async (conversationId: string, pubkeys: Array<string>) => {
  const completeUrl = await getCompleteUrlForV2ConvoId(conversationId);
  const convo = getConversationController().get(conversationId);
  if (!convo || !convo.isPublic()) {
    throw new Error('submitForOpenGroup group not found');
  }
  const groupInvitation = {
    url: completeUrl,
    name: convo.getName() || 'Unknown',
  };
  pubkeys.forEach(async pubkeyStr => {
    const privateConvo = await getConversationController().getOrCreateAndWait(
      pubkeyStr,
      ConversationTypeEnum.PRIVATE
    );

    if (privateConvo) {
      void privateConvo.sendMessage({
        body: '',
        attachments: undefined,
        groupInvitation,
        preview: undefined,
        quote: undefined,
      });
    }
  });
};

const submitForClosedGroup = async (convoId: string, pubkeys: Array<string>) => {
  const convo = getConversationController().get(convoId);
  if (!convo || !convo.isGroup()) {
    throw new Error('submitForClosedGroup group not found');
  }
  // closed group chats
  const ourPK = UserUtils.getOurPubKeyStrFromCache();
  // we only care about real members. If a member is currently a zombie we have to be able to add him back
  let existingMembers = convo.get('members') || [];
  // at least make sure it's an array
  if (!Array.isArray(existingMembers)) {
    existingMembers = [];
  }
  existingMembers = _.compact(existingMembers);
  const existingZombies = convo.get('zombies') || [];
  const newMembers = pubkeys.filter(d => !existingMembers.includes(d));

  if (newMembers.length > 0) {
    // Do not trigger an update if there is too many members
    // be sure to include current zombies in this count
    if (
      newMembers.length + existingMembers.length + existingZombies.length >
      VALIDATION.CLOSED_GROUP_SIZE_LIMIT
    ) {
      ToastUtils.pushTooManyMembers();
      return;
    }

    const allMembers = _.concat(existingMembers, newMembers, [ourPK]);
    const uniqMembers = _.uniq(allMembers);

    const groupId = convo.get('id');
    const groupName = convo.get('name');

    await initiateClosedGroupUpdate(groupId, groupName || window.i18n('unknown'), uniqMembers);
  }
};

// tslint:disable-next-line: max-func-body-length
const InviteContactsDialogInner = (props: Props) => {
  const { conversationId } = props;
  const dispatch = useDispatch();

  const privateContactPubkeys = useSelector(getPrivateContactsPubkeys);
  let validContactsForInvite = _.clone(privateContactPubkeys);

  const convoProps = useConversationPropsById(conversationId);

  const { uniqueValues: selectedContacts, addTo, removeFrom } = useSet<string>();

  if (!convoProps) {
    throw new Error('InviteContactsDialogInner not a valid convoId given');
  }
  if (!convoProps.isGroup) {
    throw new Error('InviteContactsDialogInner must be a group');
  }
  if (!convoProps.isPublic) {
    // filter our zombies and current members from the list of contact we can add
    const members = convoProps.members || [];
    const zombies = convoProps.zombies || [];
    validContactsForInvite = validContactsForInvite.filter(
      d => !members.includes(d) && !zombies.includes(d)
    );
  }

  const chatName = convoProps.name;
  const isPublicConvo = convoProps.isPublic;

  const closeDialog = () => {
    dispatch(updateInviteContactModal(null));
  };

  const onClickOK = () => {
    if (selectedContacts.length > 0) {
      if (isPublicConvo) {
        void submitForOpenGroup(conversationId, selectedContacts);
      } else {
        void submitForClosedGroup(conversationId, selectedContacts);
      }
    }

    closeDialog();
  };

  useKey((event: KeyboardEvent) => {
    return event.key === 'Enter';
  }, onClickOK);

  useKey((event: KeyboardEvent) => {
    return event.key === 'Esc' || event.key === 'Escape';
  }, closeDialog);

  const unknown = window.i18n('unknown');

  const titleText = `${window.i18n('addingContacts', [chatName || unknown])}`;
  const cancelText = window.i18n('cancel');
  const okText = window.i18n('ok');

  const hasContacts = validContactsForInvite.length > 0;

  return (
    <SessionWrapperModal title={titleText} onClose={closeDialog}>
      <SpacerLG />

      <div className="contact-selection-list">
        {hasContacts ? (
          validContactsForInvite.map((member: string) => (
            <MemberListItem
              key={member}
              pubkey={member}
              isSelected={selectedContacts.includes(member)}
              onSelect={addTo}
              onUnselect={removeFrom}
            />
          ))
        ) : (
          <>
            <SpacerLG />
            <p className="no-contacts">{window.i18n('noContactsToAdd')}</p>
            <SpacerLG />
          </>
        )}
      </div>
      <SpacerLG />

      <div className="session-modal__button-group">
        <SessionButton text={cancelText} onClick={closeDialog} />
        <SessionButton
          text={okText}
          disabled={!hasContacts}
          onClick={onClickOK}
          buttonColor={SessionButtonColor.Green}
        />
      </div>
    </SessionWrapperModal>
  );
};

export const InviteContactsDialog = InviteContactsDialogInner;
