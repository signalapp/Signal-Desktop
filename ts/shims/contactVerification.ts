// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export async function toggleVerification(id: string): Promise<void> {
  const contact = window.getConversations().get(id);
  if (contact) {
    await contact.toggleVerified();
  }
}

export async function reloadProfiles(id: string): Promise<void> {
  const contact = window.getConversations().get(id);
  if (contact) {
    await contact.getProfiles().catch(() => {
      /* nothing to do here; logging already happened */
    });
  }
}
