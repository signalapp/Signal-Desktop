import { SessionResetMessage } from '../messages/outgoing';
// import { MessageSender } from '../sending';

// These two Maps should never be accessed directly but only
// through `_update*SessionTimestamp()`, `_get*SessionRequest()` or `_has'SessionRequest()`
let sentSessionsTimestamp: Map<string, number>;
let processedSessionsTimestamp: Map<string, number>;

/**
 * We only need to fetch once from the database, because we are the only one writing to it
 */
async function _fetchFromDBIfNeeded(): Promise<void> {
  if (!sentSessionsTimestamp) {
     // TODO actually fetch from DB
    sentSessionsTimestamp = new Map<string, number>();
    processedSessionsTimestamp = new Map<string, number>();
  }
}

async function _writeToDBSentSessions(): Promise<void> {
  // TODO actually write to DB
}

async function _writeToDBProcessedSessions(): Promise<void> {
  // TODO actually write to DB
}


/**
 * This is a utility function to avoid duplicated code of _updateSentSessionTimestamp and _updateProcessedSessionTimestamp
 */
async function _updateSessionTimestamp(device: string, timestamp: number | undefined, map: Map<string, number>): Promise<boolean> {
  await _fetchFromDBIfNeeded();
  if (!timestamp) {
    return map.delete(device);
  }
  map.set(device, timestamp);

  return true;
}

/**
 *
 * @param device the device id
 * @param timestamp undefined to remove the key/value pair, otherwise updates the sent timestamp and write to DB
 */
async function _updateSentSessionTimestamp(device: string, timestamp: number|undefined): Promise<void> {
  if (_updateSessionTimestamp(device, timestamp, sentSessionsTimestamp)) {
    await _writeToDBSentSessions();
  }
}

/**
 * timestamp undefined to remove the key/value pair, otherwise updates the processed timestamp and writes to DB
 */
async function _updateProcessedSessionTimestamp(device: string, timestamp: number|undefined): Promise<void> {
  if (_updateSessionTimestamp(device, timestamp, processedSessionsTimestamp)) {
    await _writeToDBProcessedSessions();
  }
}

export function hasSession(device: string): boolean {
  return false; // TODO: Implement
}

/**
 * This is a utility function to avoid duplicate code between `_getProcessedSessionRequest()` and `_getSentSessionRequest()`
 */
async function _getSessionRequest(device: string, map: Map<string, number>): Promise<number | undefined> {
  await _fetchFromDBIfNeeded();

  return map.get(device);
}

async function _getSentSessionRequest(device: string): Promise<number | undefined> {
  return _getSessionRequest(device, processedSessionsTimestamp);
}

async function _getProcessedSessionRequest(device: string): Promise<number | undefined> {
  return _getSessionRequest(device, sentSessionsTimestamp);
}

export async function hasSentSessionRequest(device: string): Promise<boolean> {
  const hasSent = await _getSessionRequest(device, sentSessionsTimestamp);

  return !!hasSent;
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

export async function sendSessionRequests(
  message: SessionResetMessage,
  device: string
): Promise<void> {

  // Optimistically store timestamp of when session request was sent
  await _updateSentSessionTimestamp(device, Date.now());

  // await MessageSender.send()

  // TODO: Send out the request via MessageSender
  // TODO: On failure, unset the timestamp
  return Promise.resolve();
}

export async function sessionEstablished(device: string) {
  // remove our existing sent timestamp for that device
  return _updateSentSessionTimestamp(device, undefined);
}

export async function shouldProcessSessionRequest(
  device: string,
  messageTimestamp: number
): Promise<boolean> {
  const existingSentTimestamp = await _getSentSessionRequest(device) || 0;
  const existingProcessedTimestamp = await _getProcessedSessionRequest(device) || 0;

  return messageTimestamp > existingSentTimestamp && messageTimestamp > existingProcessedTimestamp;
}

export async function onSessionRequestProcessed(device: string) {
  return _updateProcessedSessionTimestamp(device, Date.now());
}
