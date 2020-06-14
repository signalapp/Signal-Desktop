import { ConversationController } from '../../window';
import { PubKey } from '../types';


export async function getGroupMembers(groupId: PubKey): Promise<Array<PubKey>> {
  const groupConversation = ConversationController.get(groupId.key);
  const groupMembers = groupConversation.attributes.members;

  if (!groupMembers) {
    return [];
  }

  return groupMembers.map((member: string) => new PubKey(member));
}

export function isMediumGroup(groupId: PubKey): boolean {
  const conversation = ConversationController.get(groupId.key);

  if (!conversation) {
    return false;
  }

  return Boolean(conversation.isMediumGroup());
}
