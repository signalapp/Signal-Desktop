/* eslint-disable no-await-in-loop */
/* eslint-disable more/no-then */
/* eslint-disable @typescript-eslint/no-misused-promises */
import { compact, concat, flatten, last, sample, toNumber, uniqBy } from 'lodash';
import { Data, Snode } from '../../../data/data';
import { SignalService } from '../../../protobuf';
import * as Receiver from '../../../receiver/receiver';
import { PubKey } from '../../types';
import { ERROR_CODE_NO_CONNECT } from './SNodeAPI';
import * as snodePool from './snodePool';

import { ConversationModel } from '../../../models/conversation';
import { ConfigMessageHandler } from '../../../receiver/configMessage';
import { decryptEnvelopeWithOurKey } from '../../../receiver/contentMessage';
import { EnvelopePlus } from '../../../receiver/types';
import { updateIsOnline } from '../../../state/ducks/onion';
import { ReleasedFeatures } from '../../../util/releaseFeature';
import {
  GenericWrapperActions,
  UserGroupsWrapperActions,
} from '../../../webworker/workers/browser/libsession_worker_interface';
import { DURATION, SWARM_POLLING_TIMEOUT } from '../../constants';
import { getConversationController } from '../../conversations';
import { IncomingMessage } from '../../messages/incoming/IncomingMessage';
import { StringUtils, UserUtils } from '../../utils';
import { LibSessionUtil } from '../../utils/libsession/libsession_utils';
import { SnodeNamespace, SnodeNamespaces } from './namespaces';
import { SnodeAPIRetrieve } from './retrieveRequest';
import { RetrieveMessageItem, RetrieveMessagesResultsBatched } from './types';
import { ed25519Str } from '../../utils/String';

export function extractWebSocketContent(
  message: string,
  messageHash: string
): null | {
  body: Uint8Array;
  messageHash: string;
} {
  try {
    const dataPlaintext = new Uint8Array(StringUtils.encode(message, 'base64'));
    const messageBuf = SignalService.WebSocketMessage.decode(dataPlaintext);
    if (
      messageBuf.type === SignalService.WebSocketMessage.Type.REQUEST &&
      messageBuf.request?.body?.length
    ) {
      return {
        body: messageBuf.request.body,
        messageHash,
      };
    }
    return null;
  } catch (error) {
    window?.log?.warn('extractWebSocketContent from message failed with:', error.message);
    return null;
  }
}

let instance: SwarmPolling | undefined;
const timeouts: Array<NodeJS.Timeout> = [];

export const getSwarmPollingInstance = () => {
  if (!instance) {
    instance = new SwarmPolling();
  }
  return instance;
};

export class SwarmPolling {
  private groupPolling: Array<{ pubkey: PubKey; lastPolledTimestamp: number }>;
  private readonly lastHashes: Record<string, Record<string, Record<number, string>>>;
  private hasStarted = false;

  constructor() {
    this.groupPolling = [];
    this.lastHashes = {};
  }

  public async start(waitForFirstPoll = false): Promise<void> {
    // when restoring from seed we have to start polling before we get on the mainPage, hence this check here to make sure we do not start twice
    if (this.hasStarted) {
      return;
    }
    this.hasStarted = true;
    this.loadGroupIds();
    if (waitForFirstPoll) {
      await this.pollForAllKeys();
    } else {
      timeouts.push(
        setTimeout(() => {
          void this.pollForAllKeys();
        }, 4000)
      );
    }
  }

  /**
   * Used for testing only
   */
  public resetSwarmPolling() {
    this.groupPolling = [];
    this.hasStarted = false;
  }

  // TODO[epic=ses-50] this is a temporary solution until onboarding is merged
  public stop(e: Error) {
    window.log.error(`[swarmPolling] stopped polling due to error: ${e.message || e}`);

    for (let i = 0; i < timeouts.length; i++) {
      clearTimeout(timeouts[i]);
      window.log.debug(`[swarmPolling] cleared timeout ${timeouts[i]} `);
    }
    this.resetSwarmPolling();
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
    if (this.groupPolling.some(group => pubkey.key === group.pubkey.key)) {
      window?.log?.info('Swarm removePubkey: removing pubkey from polling', pubkey.key);
      this.groupPolling = this.groupPolling.filter(group => !pubkey.isEqual(group.pubkey));
    }
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
      // Very important to set up a new polling call so we do retry at some point
      timeouts.push(setTimeout(this.pollForAllKeys.bind(this), SWARM_POLLING_TIMEOUT.ACTIVE));
      return;
    }
    // we always poll as often as possible for our pubkey
    const ourPubkey = UserUtils.getOurPubKeyFromCache();
    const userNamespaces = await this.getUserNamespacesPolled();
    const directPromise = Promise.all([this.pollOnceForKey(ourPubkey, false, userNamespaces)]).then(
      () => undefined
    );

    const now = Date.now();
    const groupPromises = this.groupPolling.map(async group => {
      const convoPollingTimeout = this.getPollingTimeout(group.pubkey);

      const diff = now - group.lastPolledTimestamp;

      const loggingId =
        getConversationController().get(group.pubkey.key)?.idForLogging() || group.pubkey.key;
      if (diff >= convoPollingTimeout) {
        window?.log?.debug(
          `Polling for ${loggingId}; timeout: ${convoPollingTimeout}; diff: ${diff} `
        );

        return this.pollOnceForKey(group.pubkey, true, [SnodeNamespaces.ClosedGroupMessage]);
      }
      window?.log?.debug(
        `Not polling for ${loggingId}; timeout: ${convoPollingTimeout} ; diff: ${diff}`
      );

      return Promise.resolve();
    });
    try {
      await Promise.all(concat([directPromise], groupPromises));
    } catch (e) {
      window?.log?.warn('pollForAllKeys exception: ', e);
      throw e;
    } finally {
      timeouts.push(setTimeout(this.pollForAllKeys.bind(this), SWARM_POLLING_TIMEOUT.ACTIVE));
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
    const polledPubkey = pubkey.key;
    let resultsFromAllNamespaces: RetrieveMessagesResultsBatched | null;

    const swarmSnodes = await snodePool.getSwarmFor(polledPubkey);
    let toPollFrom: Snode | undefined;
    try {
      toPollFrom = sample(swarmSnodes);

      if (!toPollFrom) {
        throw new Error(`pollOnceForKey: no snode in swarm for ${ed25519Str(polledPubkey)}`);
      }
      // Note: always print something so we know if the polling is hanging
      window.log.info(
        `about to pollNodeForKey of ${ed25519Str(pubkey.key)} from snode: ${ed25519Str(toPollFrom.pubkey_ed25519)} namespaces: ${namespaces} `
      );
      resultsFromAllNamespaces = await this.pollNodeForKey(
        toPollFrom,
        pubkey,
        namespaces,
        !isGroup
      );

      // Note: always print something so we know if the polling is hanging
      window.log.info(
        `pollNodeForKey of ${ed25519Str(pubkey.key)} from snode: ${ed25519Str(toPollFrom.pubkey_ed25519)} namespaces: ${namespaces} returned: ${resultsFromAllNamespaces?.length}`
      );
    } catch (e) {
      window.log.warn(
        `pollNodeForKey of ${pubkey} namespaces: ${namespaces} failed with: ${e.message}`
      );
      resultsFromAllNamespaces = null;
    }

    let allNamespacesWithoutUserConfigIfNeeded: Array<RetrieveMessageItem> = [];
    const userConfigLibsession = await ReleasedFeatures.checkIsUserConfigFeatureReleased();

    // check if we just fetched the details from the config namespaces.
    // If yes, merge them together and exclude them from the rest of the messages.
    if (userConfigLibsession && resultsFromAllNamespaces) {
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
      const userConfigMessagesMerged = flatten(compact(userConfigMessages));

      if (!isGroup && userConfigMessagesMerged.length) {
        window.log.info(
          `received userConfigMessages count: ${userConfigMessagesMerged.length} for key ${pubkey.key}`
        );
        try {
          await this.handleSharedConfigMessages(userConfigMessagesMerged);
        } catch (e) {
          window.log.warn(
            `handleSharedConfigMessages of ${userConfigMessagesMerged.length} failed with ${e.message}`
          );
          // not rethrowing
        }
      }

      // first make sure to handle the shared user config message first
    } else {
      allNamespacesWithoutUserConfigIfNeeded = flatten(
        compact(resultsFromAllNamespaces?.map(m => m.messages.messages))
      );
    }
    if (allNamespacesWithoutUserConfigIfNeeded.length) {
      window.log.debug(
        `received allNamespacesWithoutUserConfigIfNeeded: ${allNamespacesWithoutUserConfigIfNeeded.length}`
      );
    }

    // Merge results into one list of unique messages
    const messages = uniqBy(allNamespacesWithoutUserConfigIfNeeded, x => x.hash);

    // if all snodes returned an error (null), no need to update the lastPolledTimestamp
    if (isGroup) {
      window?.log?.debug(
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
    }

    const newMessages = await this.handleSeenMessages(messages);
    window.log.info(
      `handleSeenMessages: ${newMessages.length} out of ${messages.length} are not seen yet. snode: ${toPollFrom ? ed25519Str(toPollFrom.pubkey_ed25519) : 'undefined'}`
    );

    // don't handle incoming messages from group swarms when using the userconfig and the group is not one of the tracked group
    const isUserConfigReleaseLive = await ReleasedFeatures.checkIsUserConfigFeatureReleased();
    if (
      isUserConfigReleaseLive &&
      isGroup &&
      polledPubkey.startsWith('05') &&
      !(await UserGroupsWrapperActions.getLegacyGroup(polledPubkey)) // just check if a legacy group with that name exists
    ) {
      // that pubkey is not tracked in the wrapper anymore. Just discard those messages and make sure we are not polling
      // TODOLATER we might need to do something like this for the new closed groups once released
      getSwarmPollingInstance().removePubkey(polledPubkey);
    } else {
      // trigger the handling of all the other messages, not shared config related
      newMessages.forEach(m => {
        const content = extractWebSocketContent(m.data, m.hash);
        if (!content) {
          return;
        }

        Receiver.handleRequest(
          content.body,
          isGroup ? polledPubkey : null,
          content.messageHash,
          m.expiration
        );
      });
    }
  }

  private async handleSharedConfigMessages(userConfigMessagesMerged: Array<RetrieveMessageItem>) {
    const extractedUserConfigMessage = compact(
      userConfigMessagesMerged.map((m: RetrieveMessageItem) => {
        return extractWebSocketContent(m.data, m.hash);
      })
    );

    const allDecryptedConfigMessages: Array<IncomingMessage<SignalService.ISharedConfigMessage>> =
      [];

    for (let index = 0; index < extractedUserConfigMessage.length; index++) {
      const userConfigMessage = extractedUserConfigMessage[index];

      try {
        const envelope: EnvelopePlus = SignalService.Envelope.decode(userConfigMessage.body) as any;
        const decryptedEnvelope = await decryptEnvelopeWithOurKey(envelope);
        if (!decryptedEnvelope?.byteLength) {
          continue;
        }
        const content = SignalService.Content.decode(new Uint8Array(decryptedEnvelope));
        if (content.sharedConfigMessage) {
          const asIncomingMsg: IncomingMessage<SignalService.ISharedConfigMessage> = {
            envelopeTimestamp: toNumber(envelope.timestamp),
            message: content.sharedConfigMessage,
            messageHash: userConfigMessage.messageHash,
            authorOrGroupPubkey: envelope.source,
            authorInGroup: envelope.senderIdentity,
          };
          allDecryptedConfigMessages.push(asIncomingMsg);
        } else {
          throw new Error(
            'received a message from the namespace reserved for user config but it did not contain a sharedConfigMessage'
          );
        }
      } catch (e) {
        window.log.warn(
          `failed to decrypt message with hash "${userConfigMessage.messageHash}": ${e.message}`
        );
      }
    }
    if (allDecryptedConfigMessages.length) {
      try {
        window.log.info(
          `handleConfigMessagesViaLibSession of "${allDecryptedConfigMessages.length}" messages with libsession`
        );
        await ConfigMessageHandler.handleConfigMessagesViaLibSession(allDecryptedConfigMessages);
      } catch (e) {
        const allMessageHases = allDecryptedConfigMessages.map(m => m.messageHash).join(',');
        window.log.warn(
          `failed to handle messages hashes "${allMessageHases}" with libsession. Error: "${e.message}"`
        );
      }
    }
  }

  // Fetches messages for `pubkey` from `node` potentially updating
  // the lash hash record
  private async pollNodeForKey(
    node: Snode,
    pubkey: PubKey,
    namespaces: Array<SnodeNamespaces>,
    isUs: boolean
  ): Promise<RetrieveMessagesResultsBatched | null> {
    const namespaceLength = namespaces.length;
    if (namespaceLength <= 0) {
      throw new Error(`invalid number of retrieve namespace provided: ${namespaceLength}`);
    }
    const snodeEdkey = node.pubkey_ed25519;
    const pkStr = pubkey.key;

    try {
      const prevHashes = await Promise.all(
        namespaces.map(namespace => this.getLastHash(snodeEdkey, pkStr, namespace))
      );
      const configHashesToBump: Array<string> = [];

      if (await ReleasedFeatures.checkIsUserConfigFeatureReleased()) {
        // TODOLATER add the logic to take care of the closed groups too once we have a way to do it with the wrappers
        if (isUs) {
          for (let index = 0; index < LibSessionUtil.requiredUserVariants.length; index++) {
            const variant = LibSessionUtil.requiredUserVariants[index];
            try {
              const toBump = await GenericWrapperActions.currentHashes(variant);

              if (toBump?.length) {
                configHashesToBump.push(...toBump);
              }
            } catch (e) {
              window.log.warn(`failed to get currentHashes for user variant ${variant}`);
            }
          }
          window.log.debug(`configHashesToBump: ${configHashesToBump}`);
        }
      }

      let results = await SnodeAPIRetrieve.retrieveNextMessages(
        node,
        prevHashes,
        pkStr,
        namespaces,
        UserUtils.getOurPubKeyStrFromCache(),
        configHashesToBump
      );

      if (!results.length) {
        return [];
      }
      // NOTE when we asked to extend the expiry of the config messages, exclude it from the list of results as we do not want to mess up the last hash tracking logic
      if (configHashesToBump.length) {
        try {
          const lastResult = results[results.length - 1];
          if (lastResult?.code !== 200) {
            // the update expiry of our config messages didn't work.
            window.log.warn(
              `the update expiry of our tracked config hashes didn't work: ${JSON.stringify(
                lastResult
              )}`
            );
          }
        } catch (e) {
          // nothing to do I suppose here.
        }
        results = results.slice(0, results.length - 1);
      }

      const lastMessages = results.map(r => {
        return last(r.messages.messages);
      });

      window.log.info(
        `updating last hashes for ${ed25519Str(pubkey.key)}: ${ed25519Str(snodeEdkey)}  ${lastMessages.map(m => m?.hash || '')}`
      );
      await Promise.all(
        lastMessages.map(async (lastMessage, index) => {
          if (!lastMessage) {
            return undefined;
          }
          return this.updateLastHash({
            edkey: snodeEdkey,
            pubkey,
            namespace: namespaces[index],
            hash: lastMessage.hash,
            expiration: lastMessage.expiration,
          });
        })
      );

      return results;
    } catch (e) {
      if (e.message === ERROR_CODE_NO_CONNECT) {
        if (window.inboxStore?.getState().onionPaths.isOnline) {
          window.inboxStore?.dispatch(updateIsOnline(false));
        }
      } else if (!window.inboxStore?.getState().onionPaths.isOnline) {
        window.inboxStore?.dispatch(updateIsOnline(true));
      }
      window?.log?.info('pollNodeForKey failed with:', e.message);
      return null;
    }
  }

  private loadGroupIds() {
    const convos = getConversationController().getConversations();

    const closedGroupsOnly = convos.filter(
      (c: ConversationModel) =>
        c.isClosedGroup() && !c.isBlocked() && !c.get('isKickedFromGroup') && !c.get('left')
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
      // NOTE setting expiresAt will trigger the global function destroyExpiredMessages() on it's next interval
      const newHashes = newMessages.map((m: RetrieveMessageItem) => ({
        expiresAt: m.expiration,
        hash: m.hash,
      }));
      await Data.saveSeenMessageHashes(newHashes);
    }
    return newMessages;
  }

  private async getUserNamespacesPolled() {
    const isUserConfigRelease = await ReleasedFeatures.checkIsUserConfigFeatureReleased();
    return isUserConfigRelease
      ? [
          SnodeNamespaces.UserMessages,
          SnodeNamespaces.UserProfile,
          SnodeNamespaces.UserContacts,
          SnodeNamespaces.UserGroups,
          SnodeNamespaces.ConvoInfoVolatile,
        ]
      : [SnodeNamespaces.UserMessages];
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
