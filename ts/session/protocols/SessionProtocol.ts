// TODO: Need to flesh out these functions
// Structure of this can be changed for example sticking this all in a class
// The reason i haven't done it is to avoid having instances of the protocol, rather you should be able to call the functions directly

import { OutgoingContentMessage } from '../messages/outgoing';

export function hasSession(device: string): boolean {
  return false; // TODO: Implement
}

export function hasSentSessionRequest(device: string): boolean {
  // TODO: need a way to keep track of if we've sent a session request
  // My idea was to use the timestamp of when it was sent but there might be another better approach
  return false;
}

export async function sendSessionRequestIfNeeded(
  device: string
): Promise<void> {
  if (hasSession(device) || hasSentSessionRequest(device)) {
    return Promise.resolve();
  }

  // TODO: Call sendSessionRequest with SessionReset
  return Promise.reject(new Error('Need to implement this function'));
}

// TODO: Replace OutgoingContentMessage with SessionReset
export async function sendSessionRequest(
  message: OutgoingContentMessage
): Promise<void> {
  // TODO: Optimistically store timestamp of when session request was sent
  // TODO: Send out the request via MessageSender
  // TODO: On failure, unset the timestamp
  return Promise.resolve();
}

export function sessionEstablished(device: string) {
  // TODO: this is called when we receive an encrypted message from the other user
  // Maybe it should be renamed to something else
  // TODO: This should make `hasSentSessionRequest` return `false`
}

export function shouldProcessSessionRequest(
  device: string,
  messageTimestamp: number
): boolean {
  // TODO: Need to do the following here
  // messageTimestamp > session request sent timestamp && messageTimestamp > session request processed timestamp
  return false;
}

export function sessionRequestProcessed(device: string) {
  // TODO: this is called when we process the session request
  // This should store the processed timestamp
  // Again naming is crap so maybe some other name is better
}
