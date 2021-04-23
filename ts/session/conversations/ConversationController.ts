import {
  getAllConversations,
  getAllGroupsInvolvingId,
  removeConversation,
  saveConversation,
} from '../../data/data';
import {
  ConversationAttributes,
  ConversationCollection,
  ConversationModel,
  ConversationType,
} from '../../models/conversation';
import { BlockedNumberController } from '../../util';
import { getSnodesFor } from '../snode_api/snodePool';
import { PubKey } from '../types';
import { actions as conversationActions } from '../../state/ducks/conversations';

export class ConversationController {
  private static instance: ConversationController | null;
  private readonly conversations: ConversationCollection;
  private _initialFetchComplete: boolean = false;
  private _initialPromise?: Promise<any>;

  private constructor() {
    this.conversations = new ConversationCollection();
  }

  public static getInstance() {
    if (ConversationController.instance) {
      return ConversationController.instance;
    }
    ConversationController.instance = new ConversationController();
    return ConversationController.instance;
  }

  // FIXME this could return | undefined
  public get(id: string): ConversationModel {
    if (!this._initialFetchComplete) {
      throw new Error('ConversationController.get() needs complete initial fetch');
    }

    return this.conversations.get(id);
  }

  public getOrThrow(id: string): ConversationModel {
    if (!this._initialFetchComplete) {
      throw new Error('ConversationController.get() needs complete initial fetch');
    }

    const convo = this.conversations.get(id);

    if (convo) {
      return convo;
    }
    throw new Error(`Conversation ${id} does not exist on ConversationController.get()`);
  }
  // Needed for some model setup which happens during the initial fetch() call below
  public getUnsafe(id: string): ConversationModel | undefined {
    return this.conversations.get(id);
  }

  public dangerouslyCreateAndAdd(attributes: ConversationAttributes) {
    return this.conversations.add(attributes);
  }

  public getOrCreate(id: string, type: ConversationType) {
    if (typeof id !== 'string') {
      throw new TypeError("'id' must be a string");
    }

    if (
      type !== ConversationType.PRIVATE &&
      type !== ConversationType.GROUP &&
      type !== ConversationType.OPEN_GROUP
    ) {
      throw new TypeError(`'type' must be 'private' or 'group' or 'opengroup; got: '${type}'`);
    }

    if (!this._initialFetchComplete) {
      throw new Error('ConversationController.get() needs complete initial fetch');
    }

    let conversation = this.conversations.get(id);
    if (conversation) {
      return conversation;
    }

    conversation = this.conversations.add({
      id,
      type,
      version: 2,
    } as any);

    const create = async () => {
      try {
        await saveConversation(conversation.attributes);
      } catch (error) {
        window.log.error(
          'Conversation save failed! ',
          id,
          type,
          'Error:',
          error && error.stack ? error.stack : error
        );
        throw error;
      }

      return conversation;
    };

    conversation.initialPromise = create();
    conversation.initialPromise.then(async () => {
      if (window.inboxStore) {
        window.inboxStore?.dispatch(
          conversationActions.conversationAdded(conversation.id, conversation.getProps())
        );
      }
      if (!conversation.isPublic()) {
        await Promise.all([
          conversation.updateProfileAvatar(),
          // NOTE: we request snodes updating the cache, but ignore the result
          void getSnodesFor(id),
        ]);
      }
    });

    return conversation;
  }

  public getContactProfileNameOrShortenedPubKey(pubKey: string): string {
    const conversation = ConversationController.getInstance().get(pubKey);
    if (!conversation) {
      return pubKey;
    }
    return conversation.getContactProfileNameOrShortenedPubKey();
  }

  public getContactProfileNameOrFullPubKey(pubKey: string): string {
    const conversation = this.conversations.get(pubKey);
    if (!conversation) {
      return pubKey;
    }
    return conversation.getContactProfileNameOrFullPubKey();
  }

  public isMediumGroup(hexEncodedGroupPublicKey: string): boolean {
    const convo = this.conversations.get(hexEncodedGroupPublicKey);
    if (convo) {
      return !!convo.isMediumGroup();
    }
    return false;
  }

  public async getOrCreateAndWait(
    id: string | PubKey,
    type: ConversationType
  ): Promise<ConversationModel> {
    const initialPromise =
      this._initialPromise !== undefined ? this._initialPromise : Promise.resolve();
    return initialPromise.then(() => {
      if (!id) {
        return Promise.reject(new Error('getOrCreateAndWait: invalid id passed.'));
      }
      const pubkey = id && (id as any).key ? (id as any).key : id;
      const conversation = this.getOrCreate(pubkey, type);

      if (conversation) {
        return conversation.initialPromise.then(() => conversation);
      }

      return Promise.reject(new Error('getOrCreateAndWait: did not get conversation'));
    });
  }

  public async getAllGroupsInvolvingId(id: string) {
    const groups = await getAllGroupsInvolvingId(id);
    return groups.map((group: any) => this.conversations.add(group));
  }

  public async deleteContact(id: string) {
    if (typeof id !== 'string') {
      throw new TypeError("'id' must be a string");
    }

    if (!this._initialFetchComplete) {
      throw new Error('ConversationController.get() needs complete initial fetch');
    }

    const conversation = this.conversations.get(id);
    if (!conversation) {
      return;
    }

    // Close group leaving
    if (conversation.isClosedGroup()) {
      await conversation.leaveGroup();
    } else if (conversation.isPublic() && !conversation.isOpenGroupV2()) {
      const channelAPI = await conversation.getPublicSendData();
      if (channelAPI === null) {
        window.log.warn(`Could not get API for public conversation ${id}`);
      } else {
        channelAPI.serverAPI.partChannel((channelAPI as any).channelId);
      }
    } else if (conversation.isOpenGroupV2()) {
      window.log.warn('leave open group v2 todo');
    }

    await conversation.destroyMessages();

    await removeConversation(id);
    this.conversations.remove(conversation);
    if (window.inboxStore) {
      window.inboxStore?.dispatch(conversationActions.conversationRemoved(conversation.id));
    }
  }

  public getConversations(): Array<ConversationModel> {
    return Array.from(this.conversations.models);
  }

  public async load() {
    window.log.info('ConversationController: starting initial fetch');

    if (this.conversations.length) {
      throw new Error('ConversationController: Already loaded!');
    }

    const load = async () => {
      try {
        const collection = await getAllConversations();

        this.conversations.add(collection.models);

        this._initialFetchComplete = true;
        const promises: any = [];
        this.conversations.forEach((conversation: ConversationModel) => {
          if (!conversation.get('lastMessage')) {
            // tslint:disable-next-line: no-void-expression
            promises.push(conversation.updateLastMessage());
          }

          promises.concat([conversation.updateProfileName(), conversation.updateProfileAvatar()]);
        });

        await Promise.all(promises);

        // Remove any unused images
        window.profileImages.removeImagesNotInArray(this.conversations.map((c: any) => c.id));
        window.log.info('ConversationController: done with initial fetch');
      } catch (error) {
        window.log.error(
          'ConversationController: initial fetch failed',
          error && error.stack ? error.stack : error
        );
        throw error;
      }
    };
    await BlockedNumberController.load();

    this._initialPromise = load();

    return this._initialPromise;
  }

  public loadPromise() {
    return this._initialPromise;
  }
  public reset() {
    this._initialPromise = Promise.resolve();
    this._initialFetchComplete = false;
    if (window.inboxStore) {
      window.inboxStore?.dispatch(conversationActions.removeAllConversations());
    }
    this.conversations.reset([]);
  }
}
