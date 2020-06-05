// REMOVE COMMENT AFTER: This can just export pure functions as it doesn't need state

import { RawMessage } from '../types/RawMessage';
import { OpenGroupMessage } from '../messages/outgoing';

export async function send(message: RawMessage): Promise<void> {
  return Promise.resolve();
}

export async function sendToOpenGroup(
  message: OpenGroupMessage
): Promise<void> {
  return Promise.resolve();
}
