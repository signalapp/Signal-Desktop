import { SessionResetMessage } from '../messages/outgoing';
// import { MessageSender } from '../sending';
import { createOrUpdateItem, getItemById } from '../../../js/modules/data';

interface StringToNumberMap {
  [key: string]: number;
}
// tslint:disable: function-name
// tslint:disable: no-unnecessary-class
export class SessionProtocol {

  private static dbLoaded: Boolean = false;
  /**
   * This map olds the sent session timestamps, i.e. session requests message effectively sent to the recipient.
   * It is backed by a database entry so it's loaded from db on startup.
   * This map should not be used directly, but instead through
   * `updateSendSessionTimestamp()`, `getSendSessionRequest()` or `hasSendSessionRequest()`
   */
  private static sentSessionsTimestamp: StringToNumberMap;


  /**
   * This map olds the processed session timestamps, i.e. when we received a session request and handled it.
   * It is backed by a database entry so it's loaded from db on startup.
   * This map should not be used directly, but instead through
   * `updateProcessedSessionTimestamp()`, `getProcessedSessionRequest()` or `hasProcessedSessionRequest()`
   */
  private static processedSessionsTimestamp: StringToNumberMap;

  /**
   * This map olds the timestamp on which a sent session reset is triggered for a specific device.
   * Once the message is sent or failed to sent, this device is removed from here.
   * This is a memory only map. Which means that on app restart it's starts empty.
   */
  private static readonly pendingSendSessionsTimestamp: Set<string> = new Set();


  /** Returns true if we already have a session with that device */
  public static async hasSession(device: string): Promise<boolean> {
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
  public static async hasSentSessionRequest(device: string): Promise<boolean> {
    const pendingSend = SessionProtocol.pendingSendSessionsTimestamp.has(device);
    const hasSent = await SessionProtocol._hasSentSessionRequest(device);

    return pendingSend || hasSent;
  }

  /**
   * Triggers a SessionResetMessage to be sent if:
   *   - we do not already have a session and
   *   - we did not sent a session request already to that device and
   *   - we do not have a session request currently being send to that device
   */
  public static async sendSessionRequestIfNeeded(
    device: string
  ): Promise<void> {
    if (SessionProtocol.hasSession(device) || SessionProtocol.hasSentSessionRequest(device)) {
      return Promise.resolve();
    }

    const preKeyBundle = await window.libloki.storage.getPreKeyBundleForContact(
      device
    );
    const sessionReset = new SessionResetMessage({
      preKeyBundle,
      timestamp: Date.now(),
    });

    return SessionProtocol.sendSessionRequest(sessionReset, device);
  }

  /**  */
  public static async sendSessionRequest(
    message: SessionResetMessage,
    device: string
  ): Promise<void> {
    const timestamp = Date.now();

    // mark the session as being pending send with current timestamp
    // so we know we already triggered a new session with that device
    SessionProtocol.pendingSendSessionsTimestamp.add(device);
    // const rawMessage = toRawMessage(message);
    // // TODO: Send out the request via MessageSender

    // try {
    //   await MessageSender.send(rawMessage);
    //   await SessionProtocolupdateSentSessionTimestamp(device, timestamp);
    // } catch (e) {
    //   window.console.log('Failed to send session request to', device);
    // } finally {
    //     SessionProtocolpendingSendSessionsTimestamp.delete(device);
    // }
  }

  /**
   * Called when a session is establish so we store on database this info.
   */
  public static async onSessionEstablished(device: string) {
    // remove our existing sent timestamp for that device
    return SessionProtocol.updateSentSessionTimestamp(device, undefined);
  }

  public static async shouldProcessSessionRequest(
    device: string,
    messageTimestamp: number
  ): Promise<boolean> {
    const existingSentTimestamp = (await SessionProtocol.getSentSessionRequest(device)) || 0;
    const existingProcessedTimestamp =
      (await SessionProtocol.getProcessedSessionRequest(device)) || 0;

    return (
      messageTimestamp > existingSentTimestamp &&
      messageTimestamp > existingProcessedTimestamp
    );
  }

  public static async onSessionRequestProcessed(device: string) {
    return SessionProtocol.updateProcessedSessionTimestamp(device, Date.now());
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
      const sentItem = await getItemById(
        'sentSessionsTimestamp'
      );
      if (sentItem) {
        SessionProtocol.sentSessionsTimestamp = sentItem.value;
      } else {
        SessionProtocol.sentSessionsTimestamp = {};
      }

      const processedItem = await getItemById(
        'processedSessionsTimestamp'
      );
      if (processedItem) {
        SessionProtocol.processedSessionsTimestamp = processedItem.value;
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
    await SessionProtocol.fetchFromDBIfNeeded();
    if (!timestamp) {
      if (!!map[device]) {
        delete map.device;
        // FIXME double check how are args handle in ts (by ref/value)
        return true;
      }

      return false;
    }
    map[device] = timestamp;

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
    if (SessionProtocol.updateSessionTimestamp(device, timestamp, SessionProtocol.sentSessionsTimestamp)) {
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
    if (SessionProtocol.updateSessionTimestamp(device, timestamp, SessionProtocol.processedSessionsTimestamp)) {
      await SessionProtocol.writeToDBProcessedSessions();
    }
  }

  /**
   * This is a utility function to avoid duplicate code between `getProcessedSessionRequest()` and `getSentSessionRequest()`
   */
  private static async getSessionRequest(
    device: string,
    map: StringToNumberMap
  ): Promise<number | undefined> {
    await SessionProtocol.fetchFromDBIfNeeded();

    return map[device];
  }

  private static async getSentSessionRequest(
    device: string
  ): Promise<number | undefined> {
    return SessionProtocol.getSessionRequest(device, SessionProtocol.sentSessionsTimestamp);
  }

  private static async getProcessedSessionRequest(
    device: string
  ): Promise<number | undefined> {
    return SessionProtocol.getSessionRequest(device, SessionProtocol.processedSessionsTimestamp);
  }

  private static async _hasSentSessionRequest(device: string): Promise<boolean> {
    await SessionProtocol.fetchFromDBIfNeeded();

    return !!SessionProtocol.sentSessionsTimestamp[device];
  }
}
