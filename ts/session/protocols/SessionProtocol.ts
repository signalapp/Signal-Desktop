import { SessionResetMessage } from '../messages/outgoing';
// import { MessageSender } from '../sending';

/**
 * This map olds the sent session timestamps, i.e. session requests message effectively sent to the recipient.
 * It is backed by a database entry so it's loaded from db on startup.
 * This map should not be used directly, but instead through
 * `_updateSendSessionTimestamp()`, `_getSendSessionRequest()` or `_hasSendSessionRequest()`
 */
let sentSessionsTimestamp: Map<string, number>;

/**
 * This map olds the processed session timestamps, i.e. when we received a session request and handled it.
 * It is backed by a database entry so it's loaded from db on startup.
 * This map should not be used directly, but instead through
 * `_updateProcessedSessionTimestamp()`, `_getProcessedSessionRequest()` or `_hasProcessedSessionRequest()`
 */
let processedSessionsTimestamp: Map<string, number>;

/**
 * This map olds the timestamp on which a sent session reset is triggered for a specific device.
 * Once the message is sent or failed to sent, this device is removed from here.
 * This is a memory only map. Which means that on app restart it's starts empty.
 */
const pendingSendSessionsTimestamp: Set<string> = new Set();


/** ======= exported functions =======  */

/** Returns true if we already have a session with that device */
export async function hasSession(device: string): Promise<boolean> {
  // Session does not use the concept of a deviceId, thus it's always 1
  const address = new window.libsignal.SignalProtocolAddress(device, 1);
  const sessionCipher = new window.libsignal.SessionCipher(
    window.textsecure.storage.protocol,
    address
  );

  return sessionCipher.hasOpenSession();
}

/**
 * Returns true if we sent a session request to that device already OR
 *  if a session request to that device is right now being sent.
 */
export async function hasSentSessionRequest(device: string): Promise<boolean> {
  const pendingSend = pendingSendSessionsTimestamp.has(device);
  const hasSent = await _hasSentSessionRequest(device);

  return pendingSend || hasSent;
}

/**
 * Triggers a SessionResetMessage to be sent if:
 *   - we do not already have a session and
 *   - we did not sent a session request already to that device and
 *   - we do not have a session request currently being send to that device
 */
export async function sendSessionRequestIfNeeded(
  device: string
): Promise<void> {
  if (hasSession(device) || hasSentSessionRequest(device)) {
    return Promise.resolve();
  }

  const preKeyBundle = await window.libloki.storage.getPreKeyBundleForContact(device);
  const sessionReset = new SessionResetMessage({
    preKeyBundle,
    timestamp: Date.now(),
  });

  return sendSessionRequests(sessionReset, device);
}

/**  */
export async function sendSessionRequests(
  message: SessionResetMessage,
  device: string
): Promise<void> {
  const timestamp = Date.now();

  // mark the session as being pending send with current timestamp
  // so we know we already triggered a new session with that device
  pendingSendSessionsTimestamp.add(device);
  // const rawMessage = toRawMessage(message);
  // // TODO: Send out the request via MessageSender

  // return MessageSender.send(rawMessage)
  //   .then(async () => {
  //     await _updateSentSessionTimestamp(device, timestamp);
  //     pendingSendSessionsTimestamp.delete(device);
  //   })
  //   .catch(() => {
  //     pendingSendSessionsTimestamp.delete(device);
  //   });
}

/**
 * Called when a session is establish so we store on database this info.
 */
export async function onSessionEstablished(device: string) {
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

/** ======= local / utility functions =======  */


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
  const data = { id: 'sentSessionsTimestamp', value: JSON.stringify(sentSessionsTimestamp) };

  await window.Signal.Data.createOrUpdateItem(data);
}

async function _writeToDBProcessedSessions(): Promise<void> {
  const data = { id: 'processedSessionsTimestamp', value: JSON.stringify(processedSessionsTimestamp) };

  await window.Signal.Data.createOrUpdateItem(data);
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


/**
 * This is a utility function to avoid duplicate code between `_getProcessedSessionRequest()` and `_getSentSessionRequest()`
 */
async function _getSessionRequest(device: string, map: Map<string, number>): Promise<number | undefined> {
  await _fetchFromDBIfNeeded();

  return map.get(device);
}

async function _getSentSessionRequest(device: string): Promise<number | undefined> {
  return _getSessionRequest(device, sentSessionsTimestamp);
}

async function _getProcessedSessionRequest(device: string): Promise<number | undefined> {
  return _getSessionRequest(device, processedSessionsTimestamp);
}

async function _hasSentSessionRequest(device: string): Promise<boolean> {
  await _fetchFromDBIfNeeded();

  return sentSessionsTimestamp.has(device);
}
