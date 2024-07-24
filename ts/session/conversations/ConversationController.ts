/* eslint-disable no-await-in-loop */
/* eslint-disable more/no-then */
import { ConvoVolatileType } from 'libsession_util_nodejs';
import { isEmpty, isNil } from 'lodash';

import { Data } from '../../data/data';
import { OpenGroupData } from '../../data/opengroups';
import { ConversationCollection, ConversationModel } from '../../models/conversation';
import {
  actions as conversationActions,
  resetConversationExternal,
} from '../../state/ducks/conversations';
import { BlockedNumberController } from '../../util';
import { getOpenGroupManager } from '../apis/open_group_api/opengroupV2/OpenGroupManagerV2';
import { getSwarmFor } from '../apis/snode_api/snodePool';
import { PubKey } from '../types';

import { getMessageQueue } from '..';
import { deleteAllMessagesByConvoIdNoConfirmation } from '../../interactions/conversationInteractions';
import { removeAllClosedGroupEncryptionKeyPairs } from '../../receiver/closedGroups';
import { getCurrentlySelectedConversationOutsideRedux } from '../../state/selectors/conversations';
import { assertUnreachable } from '../../types/sqlSharedTypes';
import { UserGroupsWrapperActions } from '../../webworker/workers/browser/libsession_worker_interface';
import { OpenGroupUtils } from '../apis/open_group_api/utils';
import { getSwarmPollingInstance } from '../apis/snode_api';
import { GetNetworkTime } from '../apis/snode_api/getNetworkTime';
import { SnodeNamespaces } from '../apis/snode_api/namespaces';
import { ClosedGroupMemberLeftMessage } from '../messages/outgoing/controlMessage/group/ClosedGroupMemberLeftMessage';
import { UserUtils } from '../utils';
import { ConfigurationSync } from '../utils/job_runners/jobs/ConfigurationSyncJob';
import { LibSessionUtil } from '../utils/libsession/libsession_utils';
import { SessionUtilContact } from '../utils/libsession/libsession_utils_contacts';
import { SessionUtilConvoInfoVolatile } from '../utils/libsession/libsession_utils_convo_info_volatile';
import { SessionUtilUserGroups } from '../utils/libsession/libsession_utils_user_groups';
import { CONVERSATION_PRIORITIES, ConversationTypeEnum } from '../../models/types';

let instance: ConversationController | null;

export const getConversationController = () => {
  if (instance) {
    return instance;
  }
  instance = new ConversationController();

  return instance;
};

type DeleteOptions = { fromSyncMessage: boolean };

export class ConversationController {
  private readonly conversations: ConversationCollection;
  private _initialFetchComplete: boolean = false;
  private _initialPromise?: Promise<any>;

  /**
   * Do not call this constructor. You get the ConversationController through getConversationController() only
   */
  constructor() {
    this.conversations = new ConversationCollection();
  }

  // FIXME this could return | undefined
  public get(id: string): ConversationModel {
    if (!this._initialFetchComplete) {
      throw new Error('getConversationController().get() needs complete initial fetch');
    }

    return this.conversations.get(id);
  }

  public getOrThrow(id: string): ConversationModel {
    if (!this._initialFetchComplete) {
      throw new Error('getConversationController().get() needs complete initial fetch');
    }

    const convo = this.conversations.get(id);

    if (convo) {
      return convo;
    }
    throw new Error(`Conversation ${id} does not exist on getConversationController().get()`);
  }
  // Needed for some model setup which happens during the initial fetch() call below
  public getUnsafe(id: string): ConversationModel | undefined {
    return this.conversations.get(id);
  }

  public getOrCreate(id: string, type: ConversationTypeEnum) {
    if (typeof id !== 'string') {
      throw new TypeError("'id' must be a string");
    }

    if (
      type !== ConversationTypeEnum.PRIVATE &&
      type !== ConversationTypeEnum.GROUP &&
      type !== ConversationTypeEnum.GROUPV3
    ) {
      throw new TypeError(`'type' must be 'private' or 'group' or 'groupv3' but got: '${type}'`);
    }

    if (type === ConversationTypeEnum.GROUPV3 && !PubKey.isClosedGroupV3(id)) {
      throw new Error(
        'required v3 closed group` ` but the pubkey does not match the 03 prefix for them'
      );
    }

    if (!this._initialFetchComplete) {
      throw new Error('getConversationController().get() needs complete initial fetch');
    }

    if (this.conversations.get(id)) {
      return this.conversations.get(id) as ConversationModel;
    }

    const conversation = this.conversations.add({
      id,
      type,
    });

    const create = async () => {
      try {
        // this saves to DB and to the required wrapper
        await conversation.commit();
      } catch (error) {
        window?.log?.error(
          'Conversation save failed! ',
          id,
          type,
          'Error:',
          error && error.stack ? error.stack : error
        );
        throw error;
      }

      window?.inboxStore?.dispatch(
        conversationActions.conversationAdded({
          id: conversation.id,
          data: conversation.getConversationModelProps(),
        })
      );

      if (!conversation.isPublic() && conversation.isActive()) {
        // NOTE: we request snodes updating the cache, but ignore the result

        void getSwarmFor(id);
      }
      return conversation;
    };

    conversation.initialPromise = create();

    return conversation;
  }

  public getContactProfileNameOrShortenedPubKey(pubKey: string): string {
    const conversation = getConversationController().get(pubKey);
    if (!conversation) {
      return pubKey;
    }
    return conversation.getContactProfileNameOrShortenedPubKey();
  }

  public async getOrCreateAndWait(
    id: string | PubKey,
    type: ConversationTypeEnum
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

  /**
   * Usually, we want to mark private contact deleted as inactive (active_at = undefined).
   * That way we can still have the username and avatar for them, but they won't appear in search results etc.
   * For the blinded contact deletion though, we want to delete it completely because we merged it to an unblinded convo.
   */
  public async deleteBlindedContact(blindedId: string) {
    if (!this._initialFetchComplete) {
      throw new Error(
        'getConversationController().deleteBlindedContact() needs complete initial fetch'
      );
    }
    if (!PubKey.isBlinded(blindedId)) {
      throw new Error('deleteBlindedContact allow accepts blinded id');
    }
    window.log.info(`deleteBlindedContact with ${blindedId}`);
    const conversation = this.conversations.get(blindedId);
    if (!conversation) {
      window.log.warn(`deleteBlindedContact no such convo ${blindedId}`);
      return;
    }

    // we remove the messages left in this convo. The caller has to merge them if needed
    await deleteAllMessagesByConvoIdNoConfirmation(conversation.id);

    await conversation.setIsApproved(false, false);
    await conversation.setDidApproveMe(false, false);
    await conversation.commit();
  }

  public async deleteClosedGroup(
    groupId: string,
    options: DeleteOptions & { sendLeaveMessage: boolean; forceDeleteLocal?: boolean }
  ) {
    const conversation = await this.deleteConvoInitialChecks(groupId, 'LegacyGroup');
    if (!conversation || !conversation.isClosedGroup()) {
      return;
    }
    window.log.info(`deleteClosedGroup: ${groupId}, sendLeaveMessage?:${options.sendLeaveMessage}`);
    getSwarmPollingInstance().removePubkey(groupId); // we don't need to keep polling anymore.

    if (!options.forceDeleteLocal) {
      await leaveClosedGroup(groupId, options.fromSyncMessage);
      window.log.info(
        `deleteClosedGroup: ${groupId}, sendLeaveMessage?:${options.sendLeaveMessage}`
      );

      if (options.sendLeaveMessage) {
        await leaveClosedGroup(groupId, options.fromSyncMessage);
      }
    }

    // if we were kicked or sent our left message, we have nothing to do more with that group.
    // Just delete everything related to it, not trying to add update message or send a left message.
    await this.removeGroupOrCommunityFromDBAndRedux(groupId);
    await removeLegacyGroupFromWrappers(groupId);

    if (!options.fromSyncMessage) {
      await ConfigurationSync.queueNewJobIfNeeded();
    }
  }

  public async deleteCommunity(convoId: string, options: DeleteOptions) {
    const conversation = await this.deleteConvoInitialChecks(convoId, 'Community');
    if (!conversation || !conversation.isPublic()) {
      return;
    }

    window?.log?.info('leaving community: ', conversation.id);
    const roomInfos = OpenGroupData.getV2OpenGroupRoom(conversation.id);
    if (roomInfos) {
      getOpenGroupManager().removeRoomFromPolledRooms(roomInfos);
    }
    await removeCommunityFromWrappers(conversation.id); // this call needs to fetch the pubkey
    await this.removeGroupOrCommunityFromDBAndRedux(conversation.id);

    if (!options.fromSyncMessage) {
      await ConfigurationSync.queueNewJobIfNeeded();
    }
  }

  public async delete1o1(
    id: string,
    options: DeleteOptions & { justHidePrivate?: boolean; keepMessages?: boolean }
  ) {
    const conversation = await this.deleteConvoInitialChecks(id, '1o1', options?.keepMessages);

    if (!conversation || !conversation.isPrivate()) {
      return;
    }

    if (options.justHidePrivate || isNil(options.justHidePrivate) || conversation.isMe()) {
      // we just set the hidden field to true
      // so the conversation still exists (needed for that user's profile in groups) but is not shown on the list of conversation.
      // We also keep the messages for now, as turning a contact as hidden might just be a temporary thing
      window.log.info(`deleteContact isPrivate, marking as hidden: ${id}`);
      conversation.set({
        priority: CONVERSATION_PRIORITIES.hidden,
      });
      // We don't remove entries from the contacts wrapper, so better keep corresponding convo volatile info for now (it will be pruned if needed)
      await conversation.commit(); // this updates the wrappers content to reflect the hidden state
    } else {
      window.log.info(`deleteContact isPrivate, reset fields and removing from wrapper: ${id}`);

      await conversation.setIsApproved(false, false);
      await conversation.setDidApproveMe(false, false);
      conversation.set('active_at', 0);
      await BlockedNumberController.unblockAll([conversation.id]);
      await conversation.commit(); // first commit to DB so the DB knows about the changes
      if (SessionUtilContact.isContactToStoreInWrapper(conversation)) {
        window.log.warn('isContactToStoreInWrapper still true for ', conversation.attributes);
      }
      if (conversation.id.startsWith('05')) {
        // make sure to filter blinded contacts as it will throw otherwise
        await SessionUtilContact.removeContactFromWrapper(conversation.id); // then remove the entry alltogether from the wrapper
        await SessionUtilConvoInfoVolatile.removeContactFromWrapper(conversation.id);
      }
      if (getCurrentlySelectedConversationOutsideRedux() === conversation.id) {
        window.inboxStore?.dispatch(resetConversationExternal());
      }
    }

    if (!options.fromSyncMessage) {
      await ConfigurationSync.queueNewJobIfNeeded();
    }
  }

  /**
   *
   * @returns the reference of the list of conversations stored.
   * Warning: You should not edit things directly from that list. This must only be used for reading things.
   * If you need to make a change, do the usual getConversationControler().get('the id you want to edit')
   */
  public getConversations(): Array<ConversationModel> {
    return this.conversations.models;
  }

  public async load() {
    if (this.conversations.length) {
      throw new Error('ConversationController: Already loaded!');
    }

    const load = async () => {
      try {
        const startLoad = Date.now();

        const convoModels = await Data.getAllConversations();
        this.conversations.add(convoModels);

        const start = Date.now();
        const numberOfVariants = LibSessionUtil.requiredUserVariants.length;
        for (let index = 0; index < convoModels.length; index++) {
          const convo = convoModels[index];
          for (let wrapperIndex = 0; wrapperIndex < numberOfVariants; wrapperIndex++) {
            const variant = LibSessionUtil.requiredUserVariants[wrapperIndex];

            switch (variant) {
              case 'UserConfig':
              case 'UserGroupsConfig':
                break;
              case 'ContactsConfig':
                if (SessionUtilContact.isContactToStoreInWrapper(convo)) {
                  await SessionUtilContact.refreshMappedValue(convo.id, true);
                }
                break;
              case 'ConvoInfoVolatileConfig':
                if (SessionUtilConvoInfoVolatile.isConvoToStoreInWrapper(convo)) {
                  await SessionUtilConvoInfoVolatile.refreshConvoVolatileCached(
                    convo.id,
                    Boolean(convo.isClosedGroup() && convo.id.startsWith('05')),
                    true
                  );

                  await convo.refreshInMemoryDetails();
                }
                break;

              default:
                assertUnreachable(
                  variant,
                  `ConversationController: load() unhandled case "${variant}"`
                );
            }
          }
        }
        window.log.info(`refreshAllWrappersMappedValues took ${Date.now() - start}ms`);

        this._initialFetchComplete = true;
        window?.log?.info(
          `ConversationController: done with initial fetch in ${Date.now() - startLoad}ms.`
        );
      } catch (error) {
        window?.log?.error(
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
    if (window?.inboxStore) {
      window.inboxStore?.dispatch(conversationActions.removeAllConversations());
    }
    this.conversations.reset([]);
  }

  private async deleteConvoInitialChecks(
    convoId: string,
    deleteType: ConvoVolatileType,
    keepMessages?: boolean
  ) {
    if (!this._initialFetchComplete) {
      throw new Error(`getConversationController.${deleteType} needs to complete initial fetch`);
    }

    window.log.info(`${deleteType} with ${convoId}`);

    const conversation = this.conversations.get(convoId);
    if (!conversation) {
      window.log.warn(`${deleteType} no such convo ${convoId}`);
      return null;
    }

    // Note in some cases (hiding a conversation) we don't want to delete the messages
    if (!keepMessages) {
      // those are the stuff to do for all conversation types
      window.log.info(`${deleteType} destroyingMessages: ${convoId}`);
      await deleteAllMessagesByConvoIdNoConfirmation(convoId);
      window.log.info(`${deleteType} messages destroyed: ${convoId}`);
    }

    return conversation;
  }

  private async removeGroupOrCommunityFromDBAndRedux(convoId: string) {
    window.log.info(`cleanUpGroupConversation, removing convo from DB: ${convoId}`);
    // not a private conversation, so not a contact for the ContactWrapper
    await Data.removeConversation(convoId);

    // remove the data from the opengrouprooms table too if needed
    if (convoId && OpenGroupUtils.isOpenGroupV2(convoId)) {
      // remove the roomInfos locally for this open group room including the pubkey
      try {
        await OpenGroupData.removeV2OpenGroupRoom(convoId);
      } catch (e) {
        window?.log?.info('removeV2OpenGroupRoom failed:', e);
      }
    }

    window.log.info(`cleanUpGroupConversation, convo removed from DB: ${convoId}`);
    const conversation = this.conversations.get(convoId);

    if (conversation) {
      this.conversations.remove(conversation);

      window?.inboxStore?.dispatch(
        conversationActions.conversationsChanged([conversation.getConversationModelProps()])
      );
    }
    window.inboxStore?.dispatch(conversationActions.conversationRemoved(convoId));

    window.log.info(`cleanUpGroupConversation, convo removed from store: ${convoId}`);
  }
}

/**
 * You most likely don't want to call this function directly, but instead use the deleteLegacyGroup() from the ConversationController as it will take care of more cleaningup.
 *
 * Note: `fromSyncMessage` is used to know if we need to send a leave group message to the group first.
 * So if the user made the action on this device, fromSyncMessage should be false, but if it happened from a linked device polled update, set this to true.
 */
async function leaveClosedGroup(groupId: string, fromSyncMessage: boolean) {
  const convo = getConversationController().get(groupId);

  if (!convo || !convo.isClosedGroup()) {
    window?.log?.error('Cannot leave non-existing group');
    return;
  }

  const ourNumber = UserUtils.getOurPubKeyStrFromCache();
  const isCurrentUserAdmin = convo.get('groupAdmins')?.includes(ourNumber);

  let members: Array<string> = [];
  let admins: Array<string> = [];

  // if we are the admin, the group must be destroyed for every members
  if (isCurrentUserAdmin) {
    window?.log?.info('Admin left a closed group. We need to destroy it');
    convo.set({ left: true });
    members = [];
    admins = [];
  } else {
    // otherwise, just the exclude ourself from the members and trigger an update with this
    convo.set({ left: true });
    members = (convo.get('members') || []).filter((m: string) => m !== ourNumber);
    admins = convo.get('groupAdmins') || [];
  }
  convo.set({ members });
  await convo.updateGroupAdmins(admins, false);
  await convo.commit();

  const networkTimestamp = GetNetworkTime.getNowWithNetworkOffset();

  getSwarmPollingInstance().removePubkey(groupId);

  if (fromSyncMessage) {
    // no need to send our leave message as our other device should already have sent it.
    return;
  }

  const keypair = await Data.getLatestClosedGroupEncryptionKeyPair(groupId);
  if (!keypair || isEmpty(keypair) || isEmpty(keypair.publicHex) || isEmpty(keypair.privateHex)) {
    // if we do not have a keypair, we won't be able to send our leaving message neither, so just skip sending it.
    // this can happen when getting a group from a broken libsession usergroup wrapper, but not only.
    return;
  }

  // Send the update to the group
  const ourLeavingMessage = new ClosedGroupMemberLeftMessage({
    timestamp: networkTimestamp,
    groupId,
    expirationType: null, // we keep that one **not** expiring
    expireTimer: null,
  });

  window?.log?.info(`We are leaving the group ${groupId}. Sending our leaving message.`);
  // if we do not have a keypair for that group, we can't send our leave message, so just skip the message sending part
  const wasSent = await getMessageQueue().sendToPubKeyNonDurably({
    message: ourLeavingMessage,
    namespace: SnodeNamespaces.ClosedGroupMessage,
    pubkey: PubKey.cast(groupId),
  });
  // TODO our leaving message might fail to be sent for some specific reason we want to still delete the group.
  // for instance, if we do not have the encryption keypair anymore, we cannot send our left message, but we should still delete it's content
  if (wasSent) {
    window?.log?.info(
      `Leaving message sent ${groupId}. Removing everything related to this group.`
    );
  } else {
    window?.log?.info(
      `Leaving message failed to be sent for ${groupId}. But still removing everything related to this group....`
    );
  }
  // the rest of the cleaning of that conversation is done in the `deleteClosedGroup()`
}

async function removeLegacyGroupFromWrappers(groupId: string) {
  getSwarmPollingInstance().removePubkey(groupId);

  await UserGroupsWrapperActions.eraseLegacyGroup(groupId);
  await SessionUtilConvoInfoVolatile.removeLegacyGroupFromWrapper(groupId);
  await removeAllClosedGroupEncryptionKeyPairs(groupId);
}

async function removeCommunityFromWrappers(conversationId: string) {
  if (!conversationId || !OpenGroupUtils.isOpenGroupV2(conversationId)) {
    return;
  }
  try {
    const fromWrapper = await UserGroupsWrapperActions.getCommunityByFullUrl(conversationId);
    if (fromWrapper?.fullUrlWithPubkey) {
      await SessionUtilConvoInfoVolatile.removeCommunityFromWrapper(
        conversationId,
        fromWrapper.fullUrlWithPubkey
      );
    }
  } catch (e) {
    window?.log?.info('SessionUtilConvoInfoVolatile.removeCommunityFromWrapper failed:', e.message);
  }

  // remove from the wrapper the entries before we remove the roomInfos, as we won't have the required community pubkey afterwards
  try {
    await SessionUtilUserGroups.removeCommunityFromWrapper(conversationId, conversationId);
  } catch (e) {
    window?.log?.info('SessionUtilUserGroups.removeCommunityFromWrapper failed:', e.message);
  }
}
