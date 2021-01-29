import { PubKey } from '../types';
import { getSnodesFor, Snode } from './snodePool';
import { retrieveNextMessages } from './serviceNodeAPI';
import { SignalService } from '../../protobuf';
import * as Receiver from '../../receiver/receiver';
import _ from 'lodash';
import * as Data from '../../../js/modules/data';

import { StringUtils } from '../../session/utils';
import { ConversationController } from '../conversations';
import { ConversationModel } from '../../models/conversation';

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
      // tslint:disable-next-line no-floating-promises
      Receiver.handleRequest(messageBuf.request?.body, options);
    }
  } catch (error) {
    const info = {
      message,
      error: error.message,
    };
    window.log.warn('HTTP-Resources Failed to handle message:', info);
  }
}

export class SwarmPolling {
  private pubkeys: Array<PubKey>;
  private groupPubkeys: Array<PubKey>;
  private readonly lastHashes: { [key: string]: PubkeyToHash };

  constructor() {
    this.pubkeys = [];
    this.groupPubkeys = [];
    this.lastHashes = {};
  }

  public async start(): Promise<void> {
    this.loadGroupIds();
    void this.pollForAllKeys();
  }

  public addGroupId(pubkey: PubKey) {
    if (this.groupPubkeys.findIndex(m => m.key === pubkey.key) === -1) {
      window.log.info('Swarm addGroupId: adding pubkey to polling', pubkey.key);
      this.groupPubkeys.push(pubkey);
    }
  }

  public addPubkey(pk: PubKey | string) {
    const pubkey = PubKey.cast(pk);
    if (this.pubkeys.findIndex(m => m.key === pubkey.key) === -1) {
      this.pubkeys.push(pubkey);
    }
  }

  public removePubkey(pk: PubKey | string) {
    const pubkey = PubKey.cast(pk);
    window.log.info(
      'Swarm removePubkey: removing pubkey from polling',
      pubkey.key
    );

    this.pubkeys = this.pubkeys.filter(key => !pubkey.isEqual(key));
    this.groupPubkeys = this.groupPubkeys.filter(key => !pubkey.isEqual(key));
  }

  protected async pollOnceForKey(pubkey: PubKey, isGroup: boolean) {
    // NOTE: sometimes pubkey is string, sometimes it is object, so
    // accept both until this is fixed:
    const pkStr = pubkey.key;

    const snodes = await getSnodesFor(pkStr);

    // Select nodes for which we already have lastHashes
    const alreadyPolled = snodes.filter(
      (n: Snode) => this.lastHashes[n.pubkey_ed25519]
    );

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

    const newMessages = await this.handleSeenMessages(messages);

    newMessages.forEach((m: Message) => {
      const options = isGroup ? { conversationId: pkStr } : {};
      processMessage(m.data, options);
    });
  }

  // Fetches messages for `pubkey` from `node` potentially updating
  // the lash hash record
  protected async pollNodeForKey(
    node: Snode,
    pubkey: PubKey
  ): Promise<Array<any>> {
    const edkey = node.pubkey_ed25519;

    const pkStr = pubkey.key;

    const prevHash = await this.getLastHash(edkey, pkStr);

    const messages = await retrieveNextMessages(node, prevHash, pkStr);

    if (!messages.length) {
      return [];
    }

    const lastMessage = _.last(messages);

    await this.updateLastHash(
      edkey,
      pubkey,
      lastMessage.hash,
      lastMessage.expiration
    );

    return messages;
  }

  private loadGroupIds() {
    // Start polling for medium size groups as well (they might be in different swarms)
    const convos = ConversationController.getInstance().getConversations();

    const mediumGroupsOnly = convos.filter(
      (c: ConversationModel) =>
        c.isMediumGroup() &&
        !c.isBlocked() &&
        !c.get('isKickedFromGroup') &&
        !c.get('left')
    );

    mediumGroupsOnly.forEach((c: any) => {
      this.addGroupId(new PubKey(c.id));
      // TODO: unsubscribe if the group is deleted
    });
  }

  private async handleSeenMessages(
    messages: Array<Message>
  ): Promise<Array<Message>> {
    if (!messages.length) {
      return [];
    }

    const incomingHashes = messages.map((m: Message) => m.hash);

    const dupHashes = await Data.getSeenMessagesByHashList(incomingHashes);
    const newMessages = messages.filter(
      (m: Message) => !dupHashes.includes(m.hash)
    );

    if (newMessages.length) {
      const newHashes = newMessages.map((m: Message) => ({
        expiresAt: m.expiration,
        hash: m.hash,
      }));
      await Data.saveSeenMessageHashes(newHashes);
    }
    return newMessages;
  }

  private async pollForAllKeys() {
    const directPromises = this.pubkeys.map(async pk => {
      return this.pollOnceForKey(pk, false);
    });

    const groupPromises = this.groupPubkeys.map(async pk => {
      return this.pollOnceForKey(pk, true);
    });
    try {
      await Promise.all(_.concat(directPromises, groupPromises));
    } catch (e) {
      window.log.warn('pollForAllKeys swallowing exception: ', e);
    } finally {
      setTimeout(this.pollForAllKeys.bind(this), 2000);
    }
  }

  private async updateLastHash(
    edkey: string,
    pubkey: PubKey,
    hash: string,
    expiration: number
  ): Promise<void> {
    const pkStr = pubkey.key;

    await Data.updateLastHash({
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

  private async getLastHash(
    nodeEdKey: string,
    pubkey: string
  ): Promise<string> {
    // TODO: always retrieve from the database?

    const nodeRecords = this.lastHashes[nodeEdKey];

    if (!nodeRecords || !nodeRecords[pubkey]) {
      const lastHash = await Data.getLastHashBySnode(pubkey, nodeEdKey);

      return lastHash || '';
    } else {
      // Don't need to go to the database every time:
      return nodeRecords[pubkey];
    }
  }
}
