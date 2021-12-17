// keep this draft state local to not have to do a redux state update (a bit slow with our large state for some computers)
const draftsForConversations: Record<string, string> = {};

export function getDraftForConversation(conversationKey?: string) {
  if (!conversationKey || !draftsForConversations[conversationKey]) {
    return '';
  }
  return draftsForConversations[conversationKey] || '';
}

export function updateDraftForConversation({
  conversationKey,
  draft,
}: {
  conversationKey: string;
  draft: string;
}) {
  draftsForConversations[conversationKey] = draft;
}
