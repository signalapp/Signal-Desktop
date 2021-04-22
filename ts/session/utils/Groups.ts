import _ from 'lodash';
import { PubKey } from '../types';
import { ConversationController } from '../conversations';
import { fromHexToArray } from './String';

export async function getGroupMembers(groupId: PubKey): Promise<Array<PubKey>> {
  const groupConversation = ConversationController.getInstance().get(groupId.key);
  const groupMembers = groupConversation ? groupConversation.get('members') : undefined;

  if (!groupMembers) {
    return [];
  }

  return groupMembers.map(PubKey.cast);
}

export function isMediumGroup(groupId: PubKey): boolean {
  const conversation = ConversationController.getInstance().get(groupId.key);

  if (!conversation) {
    return false;
  }

  return Boolean(conversation.isMediumGroup());
}

export function encodeGroupPubKeyFromHex(hexGroupPublicKey: string | PubKey) {
  const pubkey = PubKey.cast(hexGroupPublicKey);
  return fromHexToArray(pubkey.key);
}
