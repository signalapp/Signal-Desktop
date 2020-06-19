import { SessionRequestMessage } from '../messages/outgoing';
// import { MessageSender } from '../sending';
import { createOrUpdateItem, getItemById } from '../../../js/modules/data';
import { MessageSender } from '../sending';
import { MessageUtils } from '../utils';
import { PubKey } from '../types';

interface StringToNumberMap {
  [key: string]: number;
}
// tslint:disable: no-unnecessary-class
export class SessionProtocol {
  private static dbLoaded: Boolean = false;
  /**
   * This map olds the sent session timestamps, i.e. session requests message effectively sent to the recipient.
   * It is backed by a database entry so it's loaded from db on startup.
   * This map should not be used directly, but instead through
   * `updateSendSessionTimestamp()`, or `hasSendSessionRequest()`
   */
  private static sentSessionsTimestamp: StringToNumberMap = {};

  /**
   * This map olds the processed session timestamps, i.e. when we received a session request and handled it.
   * It is backed by a database entry so it's loaded from db on startup.
   * This map should not be used directly, but instead through
   * `updateProcessedSessionTimestamp()`, `getProcessedSessionRequest()` or `hasProcessedSessionRequest()`
   */
  private static processedSessionsTimestamp: StringToNumberMap = {};

  /**
   * This map olds the timestamp on which a sent session reset is triggered for a specific device.
   * Once the message is sent or failed to sent, this device is removed from here.
   * This is a memory only map. Which means that on app restart it's starts empty.
   */
  private static readonly pendingSendSessionsTimestamp: Set<string> = new Set();

  public static getSentSessionsTimestamp(): Readonly<StringToNumberMap> {
    return SessionProtocol.sentSessionsTimestamp;
  }

  public static getProcessedSessionsTimestamp(): Readonly<StringToNumberMap> {
    return SessionProtocol.processedSessionsTimestamp;
  }

  public static getPendingSendSessionTimestamp(): Readonly<Set<string>> {
    return SessionProtocol.pendingSendSessionsTimestamp;
  }

  /** Returns true if we already have a session with that device */
  public static async hasSession(pubkey: PubKey): Promise<boolean> {
    // Session does not use the concept of a deviceId, thus it's always 1
    const address = new window.libsignal.SignalProtocolAddress(pubkey.key, 1);
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
  public static async hasSentSessionRequest(pubkey: PubKey): Promise<boolean> {
    const pendingSend = SessionProtocol.pendingSendSessionsTimestamp.has(
      pubkey.key
    );
    const hasSent = await SessionProtocol.hasAlreadySentSessionRequest(
      pubkey.key
    );

    return pendingSend || hasSent;
  }

  /**
   * Triggers a SessionRequestMessage to be sent if:
   *   - we do not already have a session and
   *   - we did not sent a session request already to that device and
   *   - we do not have a session request currently being sent to that device
   */
  public static async sendSessionRequestIfNeeded(
    pubkey: PubKey
  ): Promise<void> {
    if (
      (await SessionProtocol.hasSession(pubkey)) ||
      (await SessionProtocol.hasSentSessionRequest(pubkey))
    ) {
      return;
    }

    const preKeyBundle = await window.libloki.storage.getPreKeyBundleForContact(
      pubkey.key
    );

    const sessionReset = new SessionRequestMessage({
      preKeyBundle,
      timestamp: Date.now(),
    });

    try {
      await SessionProtocol.sendSessionRequest(sessionReset, pubkey);
    } catch (error) {
      console.warn('Failed to send session request to:', pubkey.key, error);
    }
  }

  /**
   *  Sends a session request message to that pubkey.
   *  We store the sent timestamp only if the message is effectively sent.
   */
  public static async sendSessionRequest(
    message: SessionRequestMessage,
    pubkey: PubKey
  ): Promise<void> {
    const timestamp = Date.now();

    // mark the session as being pending send with current timestamp
    // so we know we already triggered a new session with that device
    // so sendSessionRequestIfNeeded does not sent another session request
    SessionProtocol.pendingSendSessionsTimestamp.add(pubkey.key);

    try {
      const rawMessage = MessageUtils.toRawMessage(pubkey, message);
      await MessageSender.send(rawMessage);
      await SessionProtocol.updateSentSessionTimestamp(pubkey.key, timestamp);
    } catch (e) {
      throw e;
    } finally {
      SessionProtocol.pendingSendSessionsTimestamp.delete(pubkey.key);
    }
  }

  /**
   * Called when a session is establish so we store on database this info.
   */
  public static async onSessionEstablished(pubkey: PubKey) {
    // remove our existing sent timestamp for that device
    return SessionProtocol.updateSentSessionTimestamp(pubkey.key, undefined);
  }

  public static async shouldProcessSessionRequest(
    pubkey: PubKey,
    messageTimestamp: number
  ): Promise<boolean> {
    const existingSentTimestamp =
      (await SessionProtocol.getSentSessionRequest(pubkey.key)) || 0;
    const existingProcessedTimestamp =
      (await SessionProtocol.getProcessedSessionRequest(pubkey.key)) || 0;

    return (
      messageTimestamp > existingSentTimestamp &&
      messageTimestamp > existingProcessedTimestamp
    );
  }

  public static async onSessionRequestProcessed(pubkey: PubKey) {
    return SessionProtocol.updateProcessedSessionTimestamp(
      pubkey.key,
      Date.now()
    );
  }

  public static reset() {
    SessionProtocol.dbLoaded = false;
    SessionProtocol.sentSessionsTimestamp = {};
    SessionProtocol.processedSessionsTimestamp = {};
  }

  /**
   * We only need to fetch once from the database, because we are the only one writing to it
   */
  private static async fetchFromDBIfNeeded(): Promise<void> {
    if (!SessionProtocol.dbLoaded) {
      const sentItem = await getItemById('sentSessionsTimestamp');
      if (sentItem) {
        SessionProtocol.sentSessionsTimestamp = JSON.parse(sentItem.value);
      } else {
        SessionProtocol.sentSessionsTimestamp = {};
      }

      const processedItem = await getItemById('processedSessionsTimestamp');
      if (processedItem) {
        SessionProtocol.processedSessionsTimestamp = JSON.parse(
          processedItem.value
        );
      } else {
        SessionProtocol.processedSessionsTimestamp = {};
      }
      SessionProtocol.dbLoaded = true;
    }
  }

  private static async writeToDBSentSessions(): Promise<void> {
    const data = {
      id: 'sentSessionsTimestamp',
      value: JSON.stringify(SessionProtocol.sentSessionsTimestamp),
    };

    await createOrUpdateItem(data);
  }

  private static async writeToDBProcessedSessions(): Promise<void> {
    const data = {
      id: 'processedSessionsTimestamp',
      value: JSON.stringify(SessionProtocol.processedSessionsTimestamp),
    };

    await createOrUpdateItem(data);
  }

  /**
   * This is a utility function to avoid duplicated code of updateSentSessionTimestamp and updateProcessedSessionTimestamp
   */
  private static async updateSessionTimestamp(
    device: string,
    timestamp: number | undefined,
    map: StringToNumberMap
  ): Promise<boolean> {
    if (device === undefined) {
      throw new Error('Device cannot be undefined');
    }
    if (map[device] === timestamp) {
      return false;
    }
    if (!timestamp) {
      // tslint:disable-next-line: no-dynamic-delete
      delete map[device];
    } else {
      map[device] = timestamp;
    }

    return true;
  }

  /**
   *
   * @param device the device id
   * @param timestamp undefined to remove the key/value pair, otherwise updates the sent timestamp and write to DB
   */
  private static async updateSentSessionTimestamp(
    device: string,
    timestamp: number | undefined
  ): Promise<void> {
    await SessionProtocol.fetchFromDBIfNeeded();
    if (
      await SessionProtocol.updateSessionTimestamp(
        device,
        timestamp,
        SessionProtocol.sentSessionsTimestamp
      )
    ) {
      await SessionProtocol.writeToDBSentSessions();
    }
  }

  /**
   * timestamp undefined to remove the key/value pair, otherwise updates the processed timestamp and writes to DB
   */
  private static async updateProcessedSessionTimestamp(
    device: string,
    timestamp: number | undefined
  ): Promise<void> {
    await SessionProtocol.fetchFromDBIfNeeded();
    if (
      await SessionProtocol.updateSessionTimestamp(
        device,
        timestamp,
        SessionProtocol.processedSessionsTimestamp
      )
    ) {
      await SessionProtocol.writeToDBProcessedSessions();
    }
  }

  private static async getSentSessionRequest(
    device: string
  ): Promise<number | undefined> {
    await SessionProtocol.fetchFromDBIfNeeded();

    return SessionProtocol.sentSessionsTimestamp[device];
  }

  private static async getProcessedSessionRequest(
    device: string
  ): Promise<number | undefined> {
    await SessionProtocol.fetchFromDBIfNeeded();

    return SessionProtocol.processedSessionsTimestamp[device];
  }

  private static async hasAlreadySentSessionRequest(
    device: string
  ): Promise<boolean> {
    await SessionProtocol.fetchFromDBIfNeeded();

    return !!SessionProtocol.sentSessionsTimestamp[device];
  }
}
