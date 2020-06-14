import { getAllConversations } from '../../../js/modules/data';
import { Whisper } from '../../window';
import { PubKey } from '../types';

export async function getGroupMembers(groupId: string): Promise<Array<PubKey>> {
  const conversations = await getAllConversations({
    ConversationCollection: Whisper.ConversationCollection,
  });
  const groupConversation = conversations.find(c => c.id === groupId);

  const groupMembers = groupConversation.attributes.members;

  if (!groupMembers) {
    return [];
  }

  return groupMembers.map((member: string) => new PubKey(member));
}
