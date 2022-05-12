import { PubKey } from '../../types';
import * as snodePool from './snodePool';
import { ERROR_CODE_NO_CONNECT, retrieveNextMessages } from './SNodeAPI';
import { SignalService } from '../../../protobuf';
import * as Receiver from '../../../receiver/receiver';
import _, { concat } from 'lodash';
import {
  getLastHashBySnode,
  getSeenMessagesByHashList,
  saveSeenMessageHashes,
  Snode,
  updateLastHash,
} from '../../../data/data';

import { StringUtils, UserUtils } from '../../utils';
import { ConversationModel } from '../../../models/conversation';
import { DURATION, SWARM_POLLING_TIMEOUT } from '../../constants';
import { getConversationController } from '../../conversations';
import { perfEnd, perfStart } from '../../utils/Performance';
import { ed25519Str } from '../../onions/onionPath';
import { updateIsOnline } from '../../../state/ducks/onion';
import pRetry from 'p-retry';
import { getHasSeenHF190, getHasSeenHF191 } from './hfHandling';

interface Message {
  hash: string;
  expiration: number;
  data: string;
}

// Some websocket nonsense
export function processMessage(message: string, options: any = {}, messageHash: string) {
  try {
    const dataPlaintext = new Uint8Array(StringUtils.encode(message, 'base64'));
    const messageBuf = SignalService.WebSocketMessage.decode(dataPlaintext);
    if (messageBuf.type === SignalService.WebSocketMessage.Type.REQUEST) {
      Receiver.handleRequest(messageBuf.request?.body, options, messageHash);
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
  private readonly lastHashes: Record<string, Record<string, Record<number, string>>>;

  constructor() {
    this.groupPolling = [];
    this.lastHashes = {};
  }

  public async start(waitForFirstPoll = false): Promise<void> {
    this.loadGroupIds();
    if (waitForFirstPoll) {
      await this.pollForAllKeys();
    } else {
      void this.pollForAllKeys();
    }
  }

  /**
   * Used fo testing only
   */
  public resetSwarmPolling() {
    this.groupPolling = [];
  }

  public forcePolledTimestamp(pubkey: PubKey, lastPoll: number) {
    this.groupPolling = this.groupPolling.map(group => {
      if (PubKey.isEqual(pubkey, group.pubkey)) {
        return {
          ...group,
          lastPolledTimestamp: lastPoll,
        };
      }
      return group;
    });
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
   * Only public for testing purpose.
   *
   * Currently, a group with an
   *  -> an activeAt less than 2 days old is considered active and polled often (every 5 sec)
   *  -> an activeAt less than 1 week old is considered medium_active and polled a bit less (every minute)
   *  -> an activeAt more than a week old is considered inactive, and not polled much (every 2 minutes)
   */
  public getPollingTimeout(convoId: PubKey) {
    const convo = getConversationController().get(convoId.key);
    if (!convo) {
      return SWARM_POLLING_TIMEOUT.INACTIVE;
    }
    const activeAt = convo.get('active_at');
    if (!activeAt) {
      return SWARM_POLLING_TIMEOUT.INACTIVE;
    }

    const currentTimestamp = Date.now();

    // consider that this is an active group if activeAt is less than two days old
    if (currentTimestamp - activeAt <= DURATION.DAYS * 2) {
      return SWARM_POLLING_TIMEOUT.ACTIVE;
    }

    if (currentTimestamp - activeAt <= DURATION.DAYS * 7) {
      return SWARM_POLLING_TIMEOUT.MEDIUM_ACTIVE;
    }
    return SWARM_POLLING_TIMEOUT.INACTIVE;
  }

  /**
   * Only public for testing
   */
  public async pollForAllKeys() {
    if (!window.getGlobalOnlineStatus()) {
      window?.log?.error('pollForAllKeys: offline');
      // Important to set up a new polling
      setTimeout(this.pollForAllKeys.bind(this), SWARM_POLLING_TIMEOUT.ACTIVE);
      return;
    }
    // we always poll as often as possible for our pubkey
    const ourPubkey = UserUtils.getOurPubKeyFromCache();
    const directPromises = Promise.all([
      this.pollOnceForKey(ourPubkey, false, 0),
      // this.pollOnceForKey(ourPubkey, false, 5), // uncomment, and test me once we store the config messages to the namespace 5
    ]).then(() => undefined);

    const now = Date.now();
    const groupPromises = this.groupPolling.map(async group => {
      const convoPollingTimeout = this.getPollingTimeout(group.pubkey);

      const diff = now - group.lastPolledTimestamp;

      const loggingId =
        getConversationController()
          .get(group.pubkey.key)
          ?.idForLogging() || group.pubkey.key;

      if (diff >= convoPollingTimeout) {
        const hardfork190Happened = await getHasSeenHF190();
        const hardfork191Happened = await getHasSeenHF191();
        window?.log?.info(
          `Polling for ${loggingId}; timeout: ${convoPollingTimeout}; diff: ${diff} ; hardfork190Happened: ${hardfork190Happened}; hardfork191Happened: ${hardfork191Happened} `
        );

        if (hardfork190Happened && !hardfork191Happened) {
          // during the transition period, we poll from both namespaces (0 and -10) for groups
          return Promise.all([
            this.pollOnceForKey(group.pubkey, true, undefined),
            this.pollOnceForKey(group.pubkey, true, -10),
          ]).then(() => undefined);
        }

        if (hardfork190Happened && hardfork191Happened) {
          // after the transition period, we poll from the namespace -10 only for groups
          return this.pollOnceForKey(group.pubkey, true, -10);
        }

        // before any of those hardforks, we just poll from the default namespace being 0
        return this.pollOnceForKey(group.pubkey, true, 0);
      }
      window?.log?.info(
        `Not polling for ${loggingId}; timeout: ${convoPollingTimeout} ; diff: ${diff}`
      );

      return Promise.resolve();
    });
    try {
      await Promise.all(concat([directPromises], groupPromises));
    } catch (e) {
      window?.log?.info('pollForAllKeys exception: ', e);
      throw e;
    } finally {
      setTimeout(this.pollForAllKeys.bind(this), SWARM_POLLING_TIMEOUT.ACTIVE);
    }
  }

  /**
   * Only exposed as public for testing
   */
  public async pollOnceForKey(pubkey: PubKey, isGroup: boolean, namespace?: number) {
    const pkStr = pubkey.key;

    const swarmSnodes = await snodePool.getSwarmFor(pkStr);

    // Select nodes for which we already have lastHashes
    const alreadyPolled = swarmSnodes.filter((n: Snode) => this.lastHashes[n.pubkey_ed25519]);

    // If we need more nodes, select randomly from the remaining nodes:

    // We only poll from a single node.
    let nodesToPoll = _.sampleSize(alreadyPolled, 1);
    if (nodesToPoll.length < 1) {
      const notPolled = _.difference(swarmSnodes, alreadyPolled);

      const newNodes = _.sampleSize(notPolled, 1);

      nodesToPoll = _.concat(nodesToPoll, newNodes);
    }

    // this actually doesn't make much sense as we are at only polling from a single one
    const promisesSettled = await Promise.allSettled(
      nodesToPoll.map(async n => {
        return this.pollNodeForKey(n, pubkey, namespace);
      })
    );

    const arrayOfResultsWithNull = promisesSettled.map(entry =>
      entry.status === 'fulfilled' ? entry.value : null
    );

    // filter out null (exception thrown)
    const arrayOfResults = _.compact(arrayOfResultsWithNull);

    // Merge results into one list of unique messages
    const messages = _.uniqBy(_.flatten(arrayOfResults), (x: any) => x.hash);

    // if all snodes returned an error (null), no need to update the lastPolledTimestamp
    if (isGroup && arrayOfResults?.length) {
      window?.log?.info(
        `Polled for group(${ed25519Str(pubkey.key)}):, got ${messages.length} messages back.`
      );
      let lastPolledTimestamp = Date.now();
      if (messages.length >= 95) {
        // if we get 95 messages or more back, it means there are probably more than this
        // so make sure to retry the polling in the next 5sec by marking the last polled timestamp way before that it is really
        // this is a kind of hack
        lastPolledTimestamp = Date.now() - SWARM_POLLING_TIMEOUT.INACTIVE - 5 * 1000;
      }
      // update the last fetched timestamp
      this.groupPolling = this.groupPolling.map(group => {
        if (PubKey.isEqual(pubkey, group.pubkey)) {
          return {
            ...group,
            lastPolledTimestamp,
          };
        }
        return group;
      });
    } else if (isGroup) {
      window?.log?.info(
        `Polled for group(${ed25519Str(
          pubkey.key
        )}):, but no snode returned something else than null.`
      );
    }

    perfStart(`handleSeenMessages-${pkStr}`);

    const newMessages = await this.handleSeenMessages(messages);

    perfEnd(`handleSeenMessages-${pkStr}`, 'handleSeenMessages');

    newMessages.forEach((m: Message) => {
      const options = isGroup ? { conversationId: pkStr } : {};
      processMessage(m.data, options, m.hash);
    });
  }

  // Fetches messages for `pubkey` from `node` potentially updating
  // the lash hash record
  private async pollNodeForKey(
    node: Snode,
    pubkey: PubKey,
    namespace?: number
  ): Promise<Array<any> | null> {
    const edkey = node.pubkey_ed25519;

    const pkStr = pubkey.key;

    try {
      return await pRetry(
        async () => {
          const prevHash = await this.getLastHash(edkey, pkStr, namespace || 0);
          const messages = await retrieveNextMessages(node, prevHash, pkStr, namespace);
          if (!messages.length) {
            return [];
          }

          const lastMessage = _.last(messages);

          await this.updateLastHash({
            edkey: edkey,
            pubkey,
            namespace: namespace || 0,
            hash: lastMessage.hash,
            expiration: lastMessage.expiration,
          });
          return messages;
        },
        {
          minTimeout: 100,
          retries: 1,

          onFailedAttempt: e => {
            window?.log?.warn(
              `retrieveNextMessages attempt #${e.attemptNumber} failed. ${e.retriesLeft} retries left... ${e.name}`
            );
          },
        }
      );
    } catch (e) {
      if (e.message === ERROR_CODE_NO_CONNECT) {
        if (window.inboxStore?.getState().onionPaths.isOnline) {
          window.inboxStore?.dispatch(updateIsOnline(false));
        }
      } else {
        if (!window.inboxStore?.getState().onionPaths.isOnline) {
          window.inboxStore?.dispatch(updateIsOnline(true));
        }
      }
      window?.log?.info('pollNodeForKey failed with', e.message);
      return null;
    }
  }

  private loadGroupIds() {
    const convos = getConversationController().getConversations();

    const mediumGroupsOnly = convos.filter(
      (c: ConversationModel) =>
        c.isMediumGroup() && !c.isBlocked() && !c.get('isKickedFromGroup') && !c.get('left')
    );

    mediumGroupsOnly.forEach((c: any) => {
      this.addGroupId(new PubKey(c.id));
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

  private async updateLastHash({
    edkey,
    expiration,
    hash,
    namespace,
    pubkey,
  }: {
    edkey: string;
    pubkey: PubKey;
    namespace: number;
    hash: string;
    expiration: number;
  }): Promise<void> {
    const pkStr = pubkey.key;

    await updateLastHash({
      convoId: pkStr,
      snode: edkey,
      hash,
      expiresAt: expiration,
      namespace,
    });

    if (!this.lastHashes[edkey]) {
      this.lastHashes[edkey] = {};
    }
    if (!this.lastHashes[edkey][pkStr]) {
      this.lastHashes[edkey][pkStr] = {};
    }
    this.lastHashes[edkey][pkStr][namespace] = hash;
  }

  private async getLastHash(nodeEdKey: string, pubkey: string, namespace: number): Promise<string> {
    if (!this.lastHashes[nodeEdKey]?.[pubkey]?.[namespace]) {
      const lastHash = await getLastHashBySnode(pubkey, nodeEdKey, namespace);

      if (!this.lastHashes[nodeEdKey]) {
        this.lastHashes[nodeEdKey] = {};
      }

      if (!this.lastHashes[nodeEdKey][pubkey]) {
        this.lastHashes[nodeEdKey][pubkey] = {};
      }
      this.lastHashes[nodeEdKey][pubkey][namespace] = lastHash || '';
      return this.lastHashes[nodeEdKey][pubkey][namespace];
    }
    // return the cached value
    return this.lastHashes[nodeEdKey][pubkey][namespace];
  }
}
