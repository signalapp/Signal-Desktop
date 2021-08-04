import { PubKey } from '../types';
import * as snodePool from './snodePool';
import { retrieveNextMessages } from './SNodeAPI';
import { SignalService } from '../../protobuf';
import * as Receiver from '../../receiver/receiver';
import _ from 'lodash';
import {
  getLastHashBySnode,
  getSeenMessagesByHashList,
  saveSeenMessageHashes,
  Snode,
  updateLastHash,
} from '../../../ts/data/data';

import { StringUtils, UserUtils } from '../../session/utils';
import { ConversationModel } from '../../models/conversation';
import { DURATION, SWARM_POLLING_TIMEOUT } from '../constants';
import { getConversationController } from '../conversations';
import { perfEnd, perfStart } from '../utils/Performance';

type PubkeyToHash = { [key: string]: string };

interface Message {
  hash: string;
  expiration: number;
  data: string;
}

// Some websocket nonsense
export function processMessage(message: string, options: any = {}) {
  try {
    const dataPlaintext = new Uint8Array(StringUtils.encode(message, 'base64'));
    const messageBuf = SignalService.WebSocketMessage.decode(dataPlaintext);
    if (messageBuf.type === SignalService.WebSocketMessage.Type.REQUEST) {
      Receiver.handleRequest(messageBuf.request?.body, options);
    }
  } catch (error) {
    const info = {
      message,
      error: error.message,
    };
    window?.log?.warn('HTTP-Resources Failed to handle message:', info);
  }
}

let instance: SwarmPolling | undefined;
export const getSwarmPollingInstance = () => {
  if (!instance) {
    instance = new SwarmPolling();
  }
  return instance;
};

export class SwarmPolling {
  private groupPolling: Array<{ pubkey: PubKey; lastPolledTimestamp: number }>;
  private readonly lastHashes: { [key: string]: PubkeyToHash };

  constructor() {
    this.groupPolling = [];
    this.lastHashes = {};
  }

  public async start(waitForFirstPoll = false): Promise<void> {
    this.loadGroupIds();
    if (waitForFirstPoll) {
      await this.TEST_pollForAllKeys();
    } else {
      void this.TEST_pollForAllKeys();
    }
  }

  /**
   * Used fo testing only
   */
  public TEST_reset() {
    this.groupPolling = [];
  }

  public addGroupId(pubkey: PubKey) {
    if (this.groupPolling.findIndex(m => m.pubkey.key === pubkey.key) === -1) {
      window?.log?.info('Swarm addGroupId: adding pubkey to polling', pubkey.key);
      this.groupPolling.push({ pubkey, lastPolledTimestamp: 0 });
    }
  }

  public removePubkey(pk: PubKey | string) {
    const pubkey = PubKey.cast(pk);
    window?.log?.info('Swarm removePubkey: removing pubkey from polling', pubkey.key);
    this.groupPolling = this.groupPolling.filter(group => !pubkey.isEqual(group.pubkey));
  }

  /**
   * Only public for testing
   * As of today, we pull closed group pubkeys as follow:
   * if activeAt is not set, poll only once per hour
   * if activeAt is less than an hour old, poll every 5 seconds or so
   * if activeAt is less than a day old, poll every minutes only.
   * If activeAt is more than a day old, poll only once per hour
   */
  public TEST_getPollingTimeout(convoId: PubKey) {
    const convo = getConversationController().get(convoId.key);
    if (!convo) {
      return SWARM_POLLING_TIMEOUT.INACTIVE;
    }
    const activeAt = convo.get('active_at');
    if (!activeAt) {
      return SWARM_POLLING_TIMEOUT.INACTIVE;
    }

    const currentTimestamp = Date.now();

    // consider that this is an active group if activeAt is less than an hour old
    if (currentTimestamp - activeAt <= DURATION.HOURS * 1) {
      return SWARM_POLLING_TIMEOUT.ACTIVE;
    }

    if (currentTimestamp - activeAt <= DURATION.DAYS * 1) {
      return SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE;
    }

    return SWARM_POLLING_TIMEOUT.INACTIVE;
  }

  /**
   * Only public for testing
   */
  public async TEST_pollForAllKeys() {
    // we always poll as often as possible for our pubkey
    const ourPubkey = UserUtils.getOurPubKeyFromCache();
    const directPromise = this.TEST_pollOnceForKey(ourPubkey, false);

    const now = Date.now();
    const groupPromises = this.groupPolling.map(async group => {
      const convoPollingTimeout = this.TEST_getPollingTimeout(group.pubkey);

      const diff = now - group.lastPolledTimestamp;

      const loggingId =
        getConversationController()
          .get(group.pubkey.key)
          ?.idForLogging() || group.pubkey.key;

      if (diff >= convoPollingTimeout) {
        (window?.log?.info || console.warn)(
          `Polling for ${loggingId}; timeout: ${convoPollingTimeout} ; diff: ${diff}`
        );
        return this.TEST_pollOnceForKey(group.pubkey, true);
      }
      (window?.log?.info || console.warn)(
        `Not polling for ${loggingId}; timeout: ${convoPollingTimeout} ; diff: ${diff}`
      );

      return Promise.resolve();
    });
    try {
      await Promise.all(_.concat(directPromise, groupPromises));
    } catch (e) {
      (window?.log?.info || console.warn)('pollForAllKeys swallowing exception: ', e);
      throw e;
    } finally {
      setTimeout(this.TEST_pollForAllKeys.bind(this), SWARM_POLLING_TIMEOUT.ACTIVE);
    }
  }

  /**
   * Only exposed as public for testing
   */
  public async TEST_pollOnceForKey(pubkey: PubKey, isGroup: boolean) {
    // NOTE: sometimes pubkey is string, sometimes it is object, so
    // accept both until this is fixed:
    const pkStr = pubkey.key;

    const snodes = await snodePool.getSwarmFor(pkStr);

    // Select nodes for which we already have lastHashes
    const alreadyPolled = snodes.filter((n: Snode) => this.lastHashes[n.pubkey_ed25519]);

    // If we need more nodes, select randomly from the remaining nodes:

    // Use 1 node for now:
    const COUNT = 1;

    let nodesToPoll = _.sampleSize(alreadyPolled, COUNT);

    if (nodesToPoll.length < COUNT) {
      const notPolled = _.difference(snodes, alreadyPolled);

      const newNeeded = COUNT - alreadyPolled.length;

      const newNodes = _.sampleSize(notPolled, newNeeded);

      nodesToPoll = _.concat(nodesToPoll, newNodes);
    }

    const results = await Promise.all(
      nodesToPoll.map(async (n: Snode) => {
        return this.pollNodeForKey(n, pubkey);
      })
    );

    // Merge results into one list of unique messages
    const messages = _.uniqBy(_.flatten(results), (x: any) => x.hash);

    if (isGroup) {
      window?.log?.info(
        `Polled for group(${pubkey}): group.pubkey, got ${messages.length} messages back.`
      );
      // update the last fetched timestamp
      this.groupPolling = this.groupPolling.map(group => {
        if (PubKey.isEqual(pubkey, group.pubkey)) {
          return {
            ...group,
            lastPolledTimestamp: Date.now(),
          };
        }
        return group;
      });
    }

    perfStart(`handleSeenMessages-${pkStr}`);

    const newMessages = await this.handleSeenMessages(messages);

    perfEnd(`handleSeenMessages-${pkStr}`, 'handleSeenMessages');

    newMessages.forEach((m: Message) => {
      const options = isGroup ? { conversationId: pkStr } : {};
      processMessage(m.data, options);
    });
  }

  // Fetches messages for `pubkey` from `node` potentially updating
  // the lash hash record
  private async pollNodeForKey(node: Snode, pubkey: PubKey): Promise<Array<any>> {
    const edkey = node.pubkey_ed25519;

    const pkStr = pubkey.key;

    const prevHash = await this.getLastHash(edkey, pkStr);

    const messages = await retrieveNextMessages(node, prevHash, pkStr);

    if (!messages.length) {
      return [];
    }

    const lastMessage = _.last(messages);

    await this.updateLastHash(edkey, pubkey, lastMessage.hash, lastMessage.expiration);

    return messages;
  }

  private loadGroupIds() {
    // Start polling for medium size groups as well (they might be in different swarms)
    const convos = getConversationController().getConversations();

    const mediumGroupsOnly = convos.filter(
      (c: ConversationModel) =>
        c.isMediumGroup() && !c.isBlocked() && !c.get('isKickedFromGroup') && !c.get('left')
    );

    mediumGroupsOnly.forEach((c: any) => {
      this.addGroupId(new PubKey(c.id));
      // TODO: unsubscribe if the group is deleted
    });
  }

  private async handleSeenMessages(messages: Array<Message>): Promise<Array<Message>> {
    if (!messages.length) {
      return [];
    }

    const incomingHashes = messages.map((m: Message) => m.hash);

    const dupHashes = await getSeenMessagesByHashList(incomingHashes);
    const newMessages = messages.filter((m: Message) => !dupHashes.includes(m.hash));

    if (newMessages.length) {
      const newHashes = newMessages.map((m: Message) => ({
        expiresAt: m.expiration,
        hash: m.hash,
      }));
      await saveSeenMessageHashes(newHashes);
    }
    return newMessages;
  }

  private async updateLastHash(
    edkey: string,
    pubkey: PubKey,
    hash: string,
    expiration: number
  ): Promise<void> {
    const pkStr = pubkey.key;

    await updateLastHash({
      convoId: pkStr,
      snode: edkey,
      hash,
      expiresAt: expiration,
    });

    if (!this.lastHashes[edkey]) {
      this.lastHashes[edkey] = {};
    }

    this.lastHashes[edkey][pkStr] = hash;
  }

  private async getLastHash(nodeEdKey: string, pubkey: string): Promise<string> {
    // TODO: always retrieve from the database?

    const nodeRecords = this.lastHashes[nodeEdKey];

    if (!nodeRecords || !nodeRecords[pubkey]) {
      const lastHash = await getLastHashBySnode(pubkey, nodeEdKey);

      return lastHash || '';
    } else {
      // Don't need to go to the database every time:
      return nodeRecords[pubkey];
    }
  }
}
