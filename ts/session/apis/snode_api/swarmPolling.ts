import { PubKey } from '../../types';
import * as snodePool from './snodePool';
import { ERROR_CODE_NO_CONNECT } from './SNodeAPI';
import { SignalService } from '../../../protobuf';
import * as Receiver from '../../../receiver/receiver';
import _, { compact, concat, difference, flatten, last, sample, uniqBy } from 'lodash';
import { Data, Snode } from '../../../data/data';

import { StringUtils, UserUtils } from '../../utils';
import { ConversationModel } from '../../../models/conversation';
import { DURATION, SWARM_POLLING_TIMEOUT } from '../../constants';
import { getConversationController } from '../../conversations';
import { perfEnd, perfStart } from '../../utils/Performance';
import { ed25519Str } from '../../onions/onionPath';
import { updateIsOnline } from '../../../state/ducks/onion';
import pRetry from 'p-retry';
import { SnodeAPIRetrieve } from './retrieveRequest';
import { SnodeNamespace, SnodeNamespaces } from './namespaces';
import { RetrieveMessageItem, RetrieveMessagesResultsBatched } from './types';

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
      setTimeout(() => {
        void this.pollForAllKeys();
      }, 4000);
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
    const directPromise = Promise.all([
      this.pollOnceForKey(ourPubkey, false, [
        SnodeNamespaces.UserMessages,
        SnodeNamespaces.UserProfile,
        SnodeNamespaces.UserContacts,
      ]),
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
        window?.log?.info(
          `Polling for ${loggingId}; timeout: ${convoPollingTimeout}; diff: ${diff} `
        );

        return this.pollOnceForKey(group.pubkey, true, [SnodeNamespaces.ClosedGroupMessage]);
      }
      window?.log?.info(
        `Not polling for ${loggingId}; timeout: ${convoPollingTimeout} ; diff: ${diff}`
      );

      return Promise.resolve();
    });
    try {
      await Promise.all(concat([directPromise], groupPromises));
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
  public async pollOnceForKey(
    pubkey: PubKey,
    isGroup: boolean,
    namespaces: Array<SnodeNamespaces>
  ) {
    const pkStr = pubkey.key;

    const swarmSnodes = await snodePool.getSwarmFor(pkStr);

    // Select nodes for which we already have lastHashes
    const alreadyPolled = swarmSnodes.filter((n: Snode) => this.lastHashes[n.pubkey_ed25519]);
    let toPollFrom = alreadyPolled.length ? alreadyPolled[0] : null;

    // If we need more nodes, select randomly from the remaining nodes:
    if (!toPollFrom) {
      const notPolled = difference(swarmSnodes, alreadyPolled);
      toPollFrom = sample(notPolled) as Snode;
    }

    let resultsFromAllNamespaces: RetrieveMessagesResultsBatched | null;
    try {
      resultsFromAllNamespaces = await this.pollNodeForKey(toPollFrom, pubkey, namespaces);
    } catch (e) {
      window.log.warn(
        `pollNodeForKey of ${pubkey} namespaces: ${namespaces} failed with: ${e.message}`
      );
      resultsFromAllNamespaces = null;
    }

    let userConfigMessagesMerged: Array<RetrieveMessageItem> = [];
    let allNamespacesWithoutUserConfigIfNeeded: Array<RetrieveMessageItem> = [];

    // check if we just fetched the details from the config namespaces.
    // If yes, merge them together and exclude them from the rest of the messages.
    if (window.sessionFeatureFlags.useSharedUtilForUserConfig && resultsFromAllNamespaces) {
      const userConfigMessages = resultsFromAllNamespaces
        .filter(m => SnodeNamespace.isUserConfigNamespace(m.namespace))
        .map(r => r.messages.messages);

      allNamespacesWithoutUserConfigIfNeeded = flatten(
        compact(
          resultsFromAllNamespaces
            .filter(m => !SnodeNamespace.isUserConfigNamespace(m.namespace))
            .map(r => r.messages.messages)
        )
      );
      userConfigMessagesMerged = flatten(compact(userConfigMessages));
    } else {
      allNamespacesWithoutUserConfigIfNeeded = flatten(
        compact(resultsFromAllNamespaces?.map(m => m.messages.messages))
      );
    }

    console.info(`received userConfigMessagesMerged: ${userConfigMessagesMerged.length}`);
    console.info(
      `received allNamespacesWithoutUserConfigIfNeeded: ${allNamespacesWithoutUserConfigIfNeeded.length}`
    );

    // Merge results into one list of unique messages
    const messages = uniqBy(allNamespacesWithoutUserConfigIfNeeded, x => x.hash);

    // if all snodes returned an error (null), no need to update the lastPolledTimestamp
    if (isGroup && allNamespacesWithoutUserConfigIfNeeded?.length) {
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

    newMessages.forEach((m: RetrieveMessageItem) => {
      const options = isGroup ? { conversationId: pkStr } : {};
      processMessage(m.data, options, m.hash);
    });
  }

  // Fetches messages for `pubkey` from `node` potentially updating
  // the lash hash record
  private async pollNodeForKey(
    node: Snode,
    pubkey: PubKey,
    namespaces: Array<SnodeNamespaces>
  ): Promise<RetrieveMessagesResultsBatched | null> {
    const namespaceLength = namespaces.length;
    if (namespaceLength > 3 || namespaceLength <= 0) {
      throw new Error('pollNodeForKey needs  1 or 2 namespaces to be given at all times');
    }
    const edkey = node.pubkey_ed25519;
    const pkStr = pubkey.key;

    try {
      return await pRetry(
        async () => {
          const prevHashes = await Promise.all(
            namespaces.map(namespace => this.getLastHash(edkey, pkStr, namespace))
          );
          const results = await SnodeAPIRetrieve.retrieveNextMessages(
            node,
            prevHashes,
            pkStr,
            namespaces,
            UserUtils.getOurPubKeyStrFromCache()
          );
          if (!results.length) {
            return [];
          }

          if (results.length !== namespaceLength) {
            window.log.error(
              `pollNodeForKey asked for ${namespaceLength} namespaces but received only messages about ${results.length} namespaces`
            );
            throw new Error(
              `pollNodeForKey asked for ${namespaceLength} namespaces but received only messages about ${results.length} namespaces`
            );
          }

          const lastMessages = results.map(r => {
            return last(r.messages.messages);
          });

          await Promise.all(
            lastMessages.map(async (lastMessage, index) => {
              if (!lastMessage) {
                return;
              }
              return this.updateLastHash({
                edkey: edkey,
                pubkey,
                namespace: namespaces[index],
                hash: lastMessage.hash,
                expiration: lastMessage.expiration,
              });
            })
          );

          return results;
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
      window?.log?.info('pollNodeForKey failed with:', e.message);
      return null;
    }
  }

  private loadGroupIds() {
    const convos = getConversationController().getConversations();

    const closedGroupsOnly = convos.filter(
      (c: ConversationModel) =>
        (c.isMediumGroup() || PubKey.isClosedGroupV3(c.id)) &&
        !c.isBlocked() &&
        !c.get('isKickedFromGroup') &&
        !c.get('left')
    );

    closedGroupsOnly.forEach((c: any) => {
      this.addGroupId(new PubKey(c.id));
    });
  }

  private async handleSeenMessages(
    messages: Array<RetrieveMessageItem>
  ): Promise<Array<RetrieveMessageItem>> {
    if (!messages.length) {
      return [];
    }

    const incomingHashes = messages.map((m: RetrieveMessageItem) => m.hash);

    const dupHashes = await Data.getSeenMessagesByHashList(incomingHashes);
    const newMessages = messages.filter((m: RetrieveMessageItem) => !dupHashes.includes(m.hash));

    if (newMessages.length) {
      const newHashes = newMessages.map((m: RetrieveMessageItem) => ({
        expiresAt: m.expiration,
        hash: m.hash,
      }));
      await Data.saveSeenMessageHashes(newHashes);
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
    const cached = await this.getLastHash(edkey, pubkey.key, namespace);

    if (!cached || cached !== hash) {
      await Data.updateLastHash({
        convoId: pkStr,
        snode: edkey,
        hash,
        expiresAt: expiration,
        namespace,
      });
    }

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
      const lastHash = await Data.getLastHashBySnode(pubkey, nodeEdKey, namespace);

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
