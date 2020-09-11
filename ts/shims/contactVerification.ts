export async function toggleVerification(id: string): Promise<void> {
  const contact = window.getConversations().get(id);
  if (contact) {
    await contact.toggleVerified();
  }
}

export async function reloadProfiles(id: string): Promise<void> {
  const contact = window.getConversations().get(id);
  if (contact) {
    await contact.getProfiles();
  }
}
