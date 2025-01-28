// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce, pick, uniq, without } from 'lodash';
import PQueue from 'p-queue';
import { v4 as generateUuid } from 'uuid';
import { batch as batchDispatch } from 'react-redux';

import type {
  ConversationModelCollectionType,
  ConversationAttributesType,
  ConversationAttributesTypeType,
  ConversationRenderInfoType,
} from './model-types.d';
import type { ConversationModel } from './models/conversations';

import { DataReader, DataWriter } from './sql/Client';
import * as log from './logging/log';
import * as Errors from './types/errors';
import { getAuthorId } from './messages/helpers';
import { maybeDeriveGroupV2Id } from './groups';
import { assertDev, strictAssert } from './util/assert';
import { drop } from './util/drop';
import { isGroupV1, isGroupV2 } from './util/whatTypeOfConversation';
import type { ServiceIdString, AciString, PniString } from './types/ServiceId';
import {
  isServiceIdString,
  normalizePni,
  normalizeServiceId,
} from './types/ServiceId';
import { normalizeAci } from './util/normalizeAci';
import { sleep } from './util/sleep';
import { isNotNil } from './util/isNotNil';
import { MINUTE, SECOND } from './util/durations';
import { getServiceIdsForE164s } from './util/getServiceIdsForE164s';
import { SIGNAL_ACI, SIGNAL_AVATAR_PATH } from './types/SignalConversation';
import { getTitleNoDefault } from './util/getTitle';
import * as StorageService from './services/storage';
import type { ConversationPropsForUnreadStats } from './util/countUnreadStats';
import { countAllConversationsUnreadStats } from './util/countUnreadStats';
import { isTestOrMockEnvironment } from './environment';

type ConvoMatchType =
  | {
      key: 'serviceId' | 'pni';
      value: ServiceIdString | undefined;
      match: ConversationModel | undefined;
    }
  | {
      key: 'e164';
      value: string | undefined;
      match: ConversationModel | undefined;
    };

const { hasOwnProperty } = Object.prototype;

function applyChangeToConversation(
  conversation: ConversationModel,
  pniSignatureVerified: boolean,
  suggestedChange: Partial<
    Pick<ConversationAttributesType, 'serviceId' | 'e164' | 'pni'>
  >
) {
  const change = { ...suggestedChange };

  // Clear PNI if changing e164 without associated PNI
  if (hasOwnProperty.call(change, 'e164') && !change.pni) {
    change.pni = undefined;
  }

  // If we have a PNI but not an ACI, then the PNI will go in the serviceId field
  //   Tricky: We need a special check here, because the PNI can be in the serviceId slot
  if (
    change.pni &&
    !change.serviceId &&
    (!conversation.getServiceId() ||
      conversation.getServiceId() === conversation.getPni())
  ) {
    change.serviceId = change.pni;
  }

  // If we're clearing a PNI, but we didn't have an ACI - we need to clear serviceId field
  if (
    !change.serviceId &&
    hasOwnProperty.call(change, 'pni') &&
    !change.pni &&
    conversation.getServiceId() === conversation.getPni()
  ) {
    change.serviceId = undefined;
  }

  if (hasOwnProperty.call(change, 'serviceId')) {
    conversation.updateServiceId(change.serviceId);
  }
  if (hasOwnProperty.call(change, 'e164')) {
    conversation.updateE164(change.e164);
  }
  if (hasOwnProperty.call(change, 'pni')) {
    conversation.updatePni(change.pni, pniSignatureVerified);
  }

  // Note: we don't do a conversation.set here, because change is limited to these fields
}

export type CombineConversationsParams = Readonly<{
  current: ConversationModel;
  obsolete: ConversationModel;
  obsoleteTitleInfo?: ConversationRenderInfoType;
}>;
export type SafeCombineConversationsParams = Readonly<{ logId: string }> &
  CombineConversationsParams;

async function safeCombineConversations(
  options: SafeCombineConversationsParams
) {
  try {
    await window.ConversationController.combineConversations(options);
  } catch (error) {
    log.warn(
      `${options.logId}: error combining contacts: ${Errors.toLogFormat(error)}`
    );
  }
}

const MAX_MESSAGE_BODY_LENGTH = 64 * 1024;

const {
  getAllConversations,
  getAllGroupsInvolvingServiceId,
  getMessagesBySentAt,
} = DataReader;

const {
  migrateConversationMessages,
  removeConversation,
  saveConversation,
  updateConversation,
  updateConversations,
} = DataWriter;

// We have to run this in background.js, after all backbone models and collections on
//   Whisper.* have been created. Once those are in typescript we can use more reasonable
//   require statements for referencing these things, giving us more flexibility here.
export function start(): void {
  const conversations = new window.Whisper.ConversationCollection();

  window.ConversationController = new ConversationController(conversations);
  window.getConversations = () => conversations;
}

export class ConversationController {
  #_initialFetchComplete = false;
  #isReadOnly = false;

  private _initialPromise: undefined | Promise<void>;

  #_conversationOpenStart = new Map<string, number>();
  #_hasQueueEmptied = false;
  #_combineConversationsQueue = new PQueue({ concurrency: 1 });
  #_signalConversationId: undefined | string;

  constructor(private _conversations: ConversationModelCollectionType) {
    const debouncedUpdateUnreadCount = debounce(
      this.updateUnreadCount.bind(this),
      SECOND,
      {
        leading: true,
        maxWait: SECOND,
        trailing: true,
      }
    );

    // A few things can cause us to update the app-level unread count
    window.Whisper.events.on('updateUnreadCount', debouncedUpdateUnreadCount);
    this._conversations.on(
      'add remove change:active_at change:unreadCount change:markedUnread change:isArchived change:muteExpiresAt',
      debouncedUpdateUnreadCount
    );

    // If the conversation is muted we set a timeout so when the mute expires
    // we can reset the mute state on the model. If the mute has already expired
    // then we reset the state right away.
    this._conversations.on('add', (model: ConversationModel): void => {
      // Don't modify conversations in backup integration testing
      if (isTestOrMockEnvironment()) {
        return;
      }
      model.startMuteTimer();
    });
  }

  updateUnreadCount(): void {
    if (!this.#_hasQueueEmptied) {
      return;
    }

    const includeMuted =
      window.storage.get('badge-count-muted-conversations') || false;

    const unreadStats = countAllConversationsUnreadStats(
      this._conversations.map(
        (conversation): ConversationPropsForUnreadStats => {
          // Need to pull this out manually into the Redux shape
          // because `conversation.format()` can return cached props by the
          // time this runs
          return {
            activeAt: conversation.get('active_at') ?? undefined,
            isArchived: conversation.get('isArchived'),
            markedUnread: conversation.get('markedUnread'),
            muteExpiresAt: conversation.get('muteExpiresAt'),
            unreadCount: conversation.get('unreadCount'),
            unreadMentionsCount: conversation.get('unreadMentionsCount'),
          };
        }
      ),
      { includeMuted }
    );

    drop(window.storage.put('unreadCount', unreadStats.unreadCount));

    if (unreadStats.unreadCount > 0) {
      window.IPC.setBadge(unreadStats.unreadCount);
      window.IPC.updateTrayIcon(unreadStats.unreadCount);
      window.document.title = `${window.getTitle()} (${
        unreadStats.unreadCount
      })`;
    } else if (unreadStats.markedUnread) {
      window.IPC.setBadge('marked-unread');
      window.IPC.updateTrayIcon(1);
      window.document.title = `${window.getTitle()} (1)`;
    } else {
      window.IPC.setBadge(0);
      window.IPC.updateTrayIcon(0);
      window.document.title = window.getTitle();
    }
  }

  onEmpty(): void {
    this.#_hasQueueEmptied = true;
    this.updateUnreadCount();
  }

  get(id?: string | null): ConversationModel | undefined {
    if (!this.#_initialFetchComplete) {
      throw new Error(
        'ConversationController.get() needs complete initial fetch'
      );
    }

    // This function takes null just fine. Backbone typings are too restrictive.
    return this._conversations.get(id as string);
  }

  getAll(): Array<ConversationModel> {
    return this._conversations.models;
  }

  dangerouslyCreateAndAdd(
    attributes: Partial<ConversationAttributesType>
  ): ConversationModel {
    return this._conversations.add(attributes);
  }

  dangerouslyRemoveById(id: string): void {
    this._conversations.remove(id);
    this._conversations.resetLookups();
  }

  getOrCreate(
    identifier: string | null,
    type: ConversationAttributesTypeType,
    additionalInitialProps: Partial<ConversationAttributesType> = {}
  ): ConversationModel {
    if (typeof identifier !== 'string') {
      throw new TypeError("'id' must be a string");
    }

    if (type !== 'private' && type !== 'group') {
      throw new TypeError(
        `'type' must be 'private' or 'group'; got: '${type}'`
      );
    }

    if (!this.#_initialFetchComplete) {
      throw new Error(
        'ConversationController.get() needs complete initial fetch'
      );
    }

    let conversation = this._conversations.get(identifier);
    if (conversation) {
      return conversation;
    }

    if (this.#isReadOnly) {
      throw new Error('ConversationController is read-only');
    }

    const id = generateUuid();

    if (type === 'group') {
      conversation = this._conversations.add({
        id,
        serviceId: undefined,
        e164: undefined,
        groupId: identifier,
        type,
        version: 2,
        ...additionalInitialProps,
      });
    } else if (isServiceIdString(identifier)) {
      conversation = this._conversations.add({
        id,
        serviceId: identifier,
        e164: undefined,
        groupId: undefined,
        type,
        version: 2,
        ...additionalInitialProps,
      });
    } else {
      conversation = this._conversations.add({
        id,
        serviceId: undefined,
        e164: identifier,
        groupId: undefined,
        type,
        version: 2,
        ...additionalInitialProps,
      });
    }

    const create = async () => {
      if (!conversation.isValid()) {
        const validationError = conversation.validationError || {};
        log.error(
          'Contact is not valid. Not saving, but adding to collection:',
          conversation.idForLogging(),
          Errors.toLogFormat(validationError)
        );

        return conversation;
      }

      try {
        if (isGroupV1(conversation.attributes)) {
          maybeDeriveGroupV2Id(conversation);
        }
        await saveConversation(conversation.attributes);
      } catch (error) {
        log.error(
          'Conversation save failed! ',
          identifier,
          type,
          'Error:',
          Errors.toLogFormat(error)
        );
        throw error;
      }

      return conversation;
    };

    conversation.initialPromise = create();

    return conversation;
  }

  async getOrCreateAndWait(
    id: string | null,
    type: ConversationAttributesTypeType,
    additionalInitialProps: Partial<ConversationAttributesType> = {}
  ): Promise<ConversationModel> {
    await this.load();
    const conversation = this.getOrCreate(id, type, additionalInitialProps);

    if (conversation) {
      await conversation.initialPromise;
      return conversation;
    }

    throw new Error('getOrCreateAndWait: did not get conversation');
  }

  getConversationId(address: string | null): string | null {
    if (!address) {
      return null;
    }

    const [id] = window.textsecure.utils.unencodeNumber(address);
    const conv = this.get(id);

    if (conv) {
      return conv.get('id');
    }

    return null;
  }

  getOurConversationId(): string | undefined {
    const e164 = window.textsecure.storage.user.getNumber();
    const aci = window.textsecure.storage.user.getAci();
    const pni = window.textsecure.storage.user.getPni();

    if (!e164 && !aci && !pni) {
      return undefined;
    }

    const { conversation } = this.maybeMergeContacts({
      aci,
      e164,
      pni,
      reason: 'getOurConversationId',
    });

    return conversation.id;
  }

  getOurConversationIdOrThrow(): string {
    const conversationId = this.getOurConversationId();
    if (!conversationId) {
      throw new Error(
        'getOurConversationIdOrThrow: Failed to fetch ourConversationId'
      );
    }
    return conversationId;
  }

  getOurConversation(): ConversationModel | undefined {
    const conversationId = this.getOurConversationId();
    return conversationId ? this.get(conversationId) : undefined;
  }

  getOurConversationOrThrow(): ConversationModel {
    const conversation = this.getOurConversation();
    if (!conversation) {
      throw new Error(
        'getOurConversationOrThrow: Failed to fetch our own conversation'
      );
    }

    return conversation;
  }

  async getOrCreateSignalConversation(): Promise<ConversationModel> {
    const conversation = await this.getOrCreateAndWait(SIGNAL_ACI, 'private', {
      muteExpiresAt: Number.MAX_SAFE_INTEGER,
      profileAvatar: { path: SIGNAL_AVATAR_PATH },
      profileName: 'Signal',
      profileSharing: true,
    });

    if (conversation.get('profileAvatar')?.path !== SIGNAL_AVATAR_PATH) {
      conversation.set({
        profileAvatar: { hash: SIGNAL_AVATAR_PATH, path: SIGNAL_AVATAR_PATH },
      });
      await updateConversation(conversation.attributes);
    }

    if (!conversation.get('profileName')) {
      conversation.set({ profileName: 'Signal' });
      await updateConversation(conversation.attributes);
    }

    this.#_signalConversationId = conversation.id;

    return conversation;
  }

  isSignalConversationId(conversationId: string): boolean {
    return this.#_signalConversationId === conversationId;
  }

  areWePrimaryDevice(): boolean {
    const ourDeviceId = window.textsecure.storage.user.getDeviceId();

    return ourDeviceId === 1;
  }

  // Note: If you don't know what kind of serviceId it is, put it in the 'aci' param.
  maybeMergeContacts({
    aci: providedAci,
    e164,
    pni: providedPni,
    reason,
    fromPniSignature = false,
    mergeOldAndNew = safeCombineConversations,
  }: {
    aci?: AciString;
    e164?: string;
    pni?: PniString;
    reason: string;
    fromPniSignature?: boolean;
    mergeOldAndNew?: (options: SafeCombineConversationsParams) => Promise<void>;
  }): {
    conversation: ConversationModel;
    mergePromises: Array<Promise<void>>;
  } {
    const dataProvided = [];
    if (providedAci) {
      dataProvided.push(`aci=${providedAci}`);

      if (e164) {
        dataProvided.push('e164');
      }
      if (providedPni) {
        dataProvided.push('pni');
      }
    } else {
      if (e164) {
        dataProvided.push(`e164=${e164}`);
      }
      if (providedPni) {
        dataProvided.push(`pni=${providedPni}`);
      }
    }
    if (fromPniSignature) {
      dataProvided.push(`fromPniSignature=${fromPniSignature}`);
    }
    const logId = `maybeMergeContacts/${reason}/${dataProvided.join(',')}`;

    const aci = providedAci
      ? normalizeAci(providedAci, 'maybeMergeContacts.aci')
      : undefined;
    const pni = providedPni
      ? normalizePni(providedPni, 'maybeMergeContacts.pni')
      : undefined;
    const mergePromises: Array<Promise<void>> = [];

    const pniSignatureVerified = aci != null && pni != null && fromPniSignature;

    if (!aci && !e164 && !pni) {
      throw new Error(
        `${logId}: Need to provide at least one of: aci, e164, pni`
      );
    }

    const matches: Array<ConvoMatchType> = [
      {
        key: 'serviceId',
        value: aci,
        match: window.ConversationController.get(aci),
      },
      {
        key: 'e164',
        value: e164,
        match: window.ConversationController.get(e164),
      },
      { key: 'pni', value: pni, match: window.ConversationController.get(pni) },
    ];
    let unusedMatches: Array<ConvoMatchType> = [];

    let targetConversation: ConversationModel | undefined;
    let targetOldServiceIds:
      | {
          aci?: AciString;
          pni?: PniString;
        }
      | undefined;
    let matchCount = 0;
    matches.forEach(item => {
      const { key, value, match } = item;

      if (!value) {
        return;
      }

      if (!match) {
        if (targetConversation) {
          log.info(
            `${logId}: No match for ${key}, applying to target ` +
              `conversation - ${targetConversation.idForLogging()}`
          );
          // Note: This line might erase a known e164 or PNI
          applyChangeToConversation(targetConversation, pniSignatureVerified, {
            [key]: value,
          });
        } else {
          unusedMatches.push(item);
        }
        return;
      }

      matchCount += 1;
      unusedMatches.forEach(unused => {
        strictAssert(unused.value, 'An unused value should always be truthy');

        // Example: If we find that our PNI match has no ACI, then it will be our target.

        if (!targetConversation && !match.get(unused.key)) {
          log.info(
            `${logId}: Match on ${key} does not have ${unused.key}, ` +
              `so it will be our target conversation - ${match.idForLogging()}`
          );
          targetConversation = match;
        }
        // Tricky: PNI can end up in serviceId slot, so we need to special-case it
        if (
          !targetConversation &&
          unused.key === 'serviceId' &&
          match.get(unused.key) === pni
        ) {
          log.info(
            `${logId}: Match on ${key} has serviceId matching incoming pni, ` +
              `so it will be our target conversation - ${match.idForLogging()}`
          );
          targetConversation = match;
        }
        // Tricky: PNI can end up in serviceId slot, so we need to special-case it
        if (
          !targetConversation &&
          unused.key === 'serviceId' &&
          match.get(unused.key) === match.getPni()
        ) {
          log.info(
            `${logId}: Match on ${key} has pni/serviceId which are the same value, ` +
              `so it will be our target conversation - ${match.idForLogging()}`
          );
          targetConversation = match;
        }

        // If PNI match already has an ACI, then we need to create a new one
        if (!targetConversation) {
          targetConversation = this.getOrCreate(unused.value, 'private');
          log.info(
            `${logId}: Match on ${key} already had ${unused.key}, ` +
              `so created new target conversation - ${targetConversation.idForLogging()}`
          );
        }

        targetOldServiceIds = {
          aci: targetConversation.getAci(),
          pni: targetConversation.getPni(),
        };

        log.info(
          `${logId}: Applying new value for ${unused.key} to target conversation`
        );
        applyChangeToConversation(targetConversation, pniSignatureVerified, {
          [unused.key]: unused.value,
        });
      });

      unusedMatches = [];

      if (targetConversation && targetConversation !== match) {
        // We need to grab this before we start taking key data from it. If we're merging
        //   by e164, we want to be sure that is what is rendered in the notification.
        const obsoleteTitleInfo =
          key === 'e164'
            ? pick(match.attributes as ConversationAttributesType, [
                'e164',
                'type',
              ])
            : pick(match.attributes as ConversationAttributesType, [
                'e164',
                'profileFamilyName',
                'profileName',
                'systemGivenName',
                'systemFamilyName',
                'systemNickname',
                'type',
                'username',
              ]);

        // Clear the value on the current match, since it belongs on targetConversation!
        //   Note: we need to do the remove first, because it will clear the lookup!
        log.info(
          `${logId}: Clearing ${key} on match, and adding it to target ` +
            `conversation - ${targetConversation.idForLogging()}`
        );
        const change: Pick<
          Partial<ConversationAttributesType>,
          'serviceId' | 'e164' | 'pni'
        > = {
          [key]: undefined,
        };
        // When the PNI is being used in the serviceId field alone, we need to clear it
        if ((key === 'pni' || key === 'e164') && match.getServiceId() === pni) {
          change.serviceId = undefined;
        }
        applyChangeToConversation(match, pniSignatureVerified, change);

        // Note: The PNI check here is just to be bulletproof; if we know a
        //   serviceId is a PNI, then that should be put in the serviceId field
        //   as well!
        const willMerge =
          !match.getServiceId() && !match.get('e164') && !match.getPni();

        applyChangeToConversation(targetConversation, pniSignatureVerified, {
          [key]: value,
        });

        if (willMerge) {
          log.warn(
            `${logId}: Removing old conversation which matched on ${key}. ` +
              `Merging with target conversation - ${targetConversation.idForLogging()}`
          );
          mergePromises.push(
            mergeOldAndNew({
              current: targetConversation,
              logId,
              obsolete: match,
              obsoleteTitleInfo,
            })
          );
        }
      } else if (targetConversation && !targetConversation?.get(key)) {
        // This is mostly for the situation where PNI was erased when updating e164
        log.debug(
          `${logId}: Re-adding ${key} on target conversation - ` +
            `${targetConversation.idForLogging()}`
        );
        applyChangeToConversation(targetConversation, pniSignatureVerified, {
          [key]: value,
        });
      }

      if (!targetConversation) {
        // log.debug(
        //   `${logId}: Match on ${key} is target conversation - ${match.idForLogging()}`
        // );
        targetConversation = match;
        targetOldServiceIds = {
          aci: targetConversation.getAci(),
          pni: targetConversation.getPni(),
        };
      }
    });

    // If the change is not coming from PNI Signature, and target conversation
    // had PNI and has acquired new ACI and/or PNI we should check if it had
    // a PNI session on the original PNI. If yes - add a PhoneNumberDiscovery notification
    if (
      e164 &&
      pni &&
      targetConversation &&
      targetOldServiceIds?.pni &&
      !fromPniSignature &&
      (targetOldServiceIds.pni !== pni ||
        (aci && targetOldServiceIds.aci !== aci))
    ) {
      targetConversation.unset('needsTitleTransition');
      mergePromises.push(
        targetConversation.addPhoneNumberDiscoveryIfNeeded(
          targetOldServiceIds.pni
        )
      );
    }

    if (targetConversation) {
      return { conversation: targetConversation, mergePromises };
    }

    strictAssert(
      matchCount === 0,
      `${logId}: should be no matches if no targetConversation`
    );

    log.info(`${logId}: Creating a new conversation with all inputs`);

    // This is not our precedence for lookup, but it ensures that the PNI gets into the
    //   serviceId slot if we have no ACI.
    const identifier = aci || pni || e164;
    strictAssert(identifier, `${logId}: identifier must be truthy!`);

    return {
      conversation: this.getOrCreate(identifier, 'private', { e164, pni }),
      mergePromises,
    };
  }

  /**
   * Given a serviceId and/or an E164, returns a string representing the local
   * database id of the given contact. Will create a new conversation if none exists;
   * otherwise will return whatever is found.
   */
  lookupOrCreate({
    e164,
    serviceId,
    reason,
  }: {
    e164?: string | null;
    serviceId?: ServiceIdString | null;
    reason: string;
  }): ConversationModel | undefined {
    const normalizedServiceId = serviceId
      ? normalizeServiceId(serviceId, 'ConversationController.lookupOrCreate')
      : undefined;
    const identifier = normalizedServiceId || e164;

    if ((!e164 && !serviceId) || !identifier) {
      log.warn(
        `lookupOrCreate: Called with neither e164 nor serviceId! reason: ${reason}`
      );
      return undefined;
    }

    const convoE164 = this.get(e164);
    const convoServiceId = this.get(normalizedServiceId);

    // 1. Handle no match at all
    if (!convoE164 && !convoServiceId) {
      log.info('lookupOrCreate: Creating new contact, no matches found');
      const newConvo = this.getOrCreate(identifier, 'private');

      // `identifier` would resolve to serviceId if we had both, so fix up e164
      if (normalizedServiceId && e164) {
        newConvo.updateE164(e164);
      }

      return newConvo;
    }

    // 2. Handle match on only service id
    if (!convoE164 && convoServiceId) {
      return convoServiceId;
    }

    // 3. Handle match on only E164
    if (convoE164 && !convoServiceId) {
      return convoE164;
    }

    // For some reason, TypeScript doesn't believe that we can trust that these two values
    //   are truthy by this point. So we'll throw if that isn't the case.
    if (!convoE164 || !convoServiceId) {
      throw new Error(
        `lookupOrCreate: convoE164 or convoServiceId are falsey but should both be true! reason: ${reason}`
      );
    }

    // 4. If the two lookups agree, return that conversation
    if (convoE164 === convoServiceId) {
      return convoServiceId;
    }

    // 5. If the two lookups disagree, log and return the service id match
    log.warn(
      `lookupOrCreate: Found a split contact - service id ${normalizedServiceId} and E164 ${e164}. Returning service id match. reason: ${reason}`
    );
    return convoServiceId;
  }

  checkForConflicts(): Promise<void> {
    return this.#_combineConversationsQueue.add(() =>
      this.#doCheckForConflicts()
    );
  }

  // Note: `doCombineConversations` is directly used within this function since both
  //   run on `_combineConversationsQueue` queue and we don't want deadlocks.
  async #doCheckForConflicts(): Promise<void> {
    log.info('ConversationController.checkForConflicts: starting...');
    const byServiceId = Object.create(null);
    const byE164 = Object.create(null);
    const byGroupV2Id = Object.create(null);
    // We also want to find duplicate GV1 IDs. You might expect to see a "byGroupV1Id" map
    //   here. Instead, we check for duplicates on the derived GV2 ID.

    const { models } = this._conversations;

    // We iterate from the oldest conversations to the newest. This allows us, in a
    //   conflict case, to keep the one with activity the most recently.
    for (let i = models.length - 1; i >= 0; i -= 1) {
      const conversation = models[i];
      assertDev(
        conversation,
        'Expected conversation to be found in array during iteration'
      );

      const serviceId = conversation.getServiceId();
      const pni = conversation.getPni();
      const e164 = conversation.get('e164');

      if (serviceId) {
        const existing = byServiceId[serviceId];
        if (!existing) {
          byServiceId[serviceId] = conversation;
        } else {
          log.warn(
            `checkForConflicts: Found conflict with serviceId ${serviceId}`
          );

          // Keep the newer one if it has an e164, otherwise keep existing
          if (conversation.get('e164')) {
            // Keep new one
            // eslint-disable-next-line no-await-in-loop
            await this.#doCombineConversations({
              current: conversation,
              obsolete: existing,
            });
            byServiceId[serviceId] = conversation;
          } else {
            // Keep existing - note that this applies if neither had an e164
            // eslint-disable-next-line no-await-in-loop
            await this.#doCombineConversations({
              current: existing,
              obsolete: conversation,
            });
          }
        }
      }

      if (pni) {
        const existing = byServiceId[pni];
        if (!existing) {
          byServiceId[pni] = conversation;
        } else if (existing === conversation) {
          // Conversation has both service id and pni set to the same value. This
          // happens when starting a conversation by E164.
          assertDev(
            pni === serviceId,
            'checkForConflicts: expected PNI to be equal to serviceId'
          );
        } else {
          log.warn(`checkForConflicts: Found conflict with pni ${pni}`);

          // Keep the newer one if it has additional data, otherwise keep existing
          if (conversation.get('e164') || conversation.getPni()) {
            // Keep new one
            // eslint-disable-next-line no-await-in-loop
            await this.#doCombineConversations({
              current: conversation,
              obsolete: existing,
            });
            byServiceId[pni] = conversation;
          } else {
            // Keep existing - note that this applies if neither had an e164
            // eslint-disable-next-line no-await-in-loop
            await this.#doCombineConversations({
              current: existing,
              obsolete: conversation,
            });
          }
        }
      }

      if (e164) {
        const existing = byE164[e164];
        if (!existing) {
          byE164[e164] = conversation;
        } else {
          // If we have two contacts with the same e164 but different truthy
          //   service ids, then we'll delete the e164 on the older one
          if (
            conversation.getServiceId() &&
            existing.getServiceId() &&
            conversation.getServiceId() !== existing.getServiceId()
          ) {
            log.warn(
              `checkForConflicts: Found two matches on e164 ${e164} with different truthy service ids. Dropping e164 on older.`
            );

            existing.set({ e164: undefined });
            drop(updateConversation(existing.attributes));

            byE164[e164] = conversation;

            continue;
          }

          log.warn(`checkForConflicts: Found conflict with e164 ${e164}`);

          // Keep the newer one if it has a service id, otherwise keep existing
          if (conversation.getServiceId()) {
            // Keep new one
            // eslint-disable-next-line no-await-in-loop
            await this.#doCombineConversations({
              current: conversation,
              obsolete: existing,
            });
            byE164[e164] = conversation;
          } else {
            // Keep existing - note that this applies if neither had a service id
            // eslint-disable-next-line no-await-in-loop
            await this.#doCombineConversations({
              current: existing,
              obsolete: conversation,
            });
          }
        }
      }

      let groupV2Id: undefined | string;
      if (isGroupV1(conversation.attributes)) {
        maybeDeriveGroupV2Id(conversation);
        groupV2Id = conversation.get('derivedGroupV2Id');
        assertDev(
          groupV2Id,
          'checkForConflicts: expected the group V2 ID to have been derived, but it was falsy'
        );
      } else if (isGroupV2(conversation.attributes)) {
        groupV2Id = conversation.get('groupId');
      }

      if (groupV2Id) {
        const existing = byGroupV2Id[groupV2Id];
        if (!existing) {
          byGroupV2Id[groupV2Id] = conversation;
        } else {
          const logParenthetical = isGroupV1(conversation.attributes)
            ? ' (derived from a GV1 group ID)'
            : '';
          log.warn(
            `checkForConflicts: Found conflict with group V2 ID ${groupV2Id}${logParenthetical}`
          );

          // Prefer the GV2 group.
          if (
            isGroupV2(conversation.attributes) &&
            !isGroupV2(existing.attributes)
          ) {
            // eslint-disable-next-line no-await-in-loop
            await this.#doCombineConversations({
              current: conversation,
              obsolete: existing,
            });
            byGroupV2Id[groupV2Id] = conversation;
          } else {
            // eslint-disable-next-line no-await-in-loop
            await this.#doCombineConversations({
              current: existing,
              obsolete: conversation,
            });
          }
        }
      }
    }

    log.info('checkForConflicts: complete!');
  }

  async combineConversations(
    options: CombineConversationsParams
  ): Promise<void> {
    return this.#_combineConversationsQueue.add(() =>
      this.#doCombineConversations(options)
    );
  }

  async #doCombineConversations({
    current,
    obsolete,
    obsoleteTitleInfo,
  }: CombineConversationsParams): Promise<void> {
    const logId = `combineConversations/${obsolete.id}->${current.id}`;

    const conversationType = current.get('type');

    if (!this.get(obsolete.id)) {
      log.warn(`${logId}: Already combined obsolete conversation`);
      return;
    }

    if (obsolete.get('type') !== conversationType) {
      assertDev(
        false,
        `${logId}: cannot combine a private and group conversation. Doing nothing`
      );
      return;
    }

    log.warn(
      `${logId}: Combining two conversations -`,
      `old: ${obsolete.idForLogging()} -> new: ${current.idForLogging()}`
    );

    const obsoleteActiveAt = obsolete.get('active_at');
    const currentActiveAt = current.get('active_at');
    let activeAt: number | null | undefined;

    if (obsoleteActiveAt && currentActiveAt) {
      activeAt = Math.max(obsoleteActiveAt, currentActiveAt);
    } else {
      activeAt = obsoleteActiveAt || currentActiveAt;
    }
    current.set('active_at', activeAt);

    current.set(
      'expireTimerVersion',
      Math.max(
        obsolete.get('expireTimerVersion') ?? 1,
        current.get('expireTimerVersion') ?? 1
      )
    );

    const obsoleteExpireTimer = obsolete.get('expireTimer');
    const currentExpireTimer = current.get('expireTimer');
    if (
      !currentExpireTimer ||
      (obsoleteExpireTimer && obsoleteExpireTimer < currentExpireTimer)
    ) {
      current.set('expireTimer', obsoleteExpireTimer);
    }

    const currentHadMessages = (current.get('messageCount') ?? 0) > 0;

    const dataToCopy: Partial<ConversationAttributesType> = pick(
      obsolete.attributes,
      [
        'conversationColor',
        'customColor',
        'customColorId',
        'draftAttachments',
        'draftBodyRanges',
        'draftTimestamp',
        'draft',
        'draftEditMessage',
        'messageCount',
        'messageRequestResponseType',
        'needsTitleTransition',
        'profileSharing',
        'quotedMessageId',
        'sentMessageCount',
      ]
    );

    const keys = Object.keys(dataToCopy) as Array<
      keyof ConversationAttributesType
    >;
    keys.forEach(key => {
      if (current.get(key) === undefined) {
        current.set(key, dataToCopy[key]);

        // To ensure that any files on disk don't get deleted out from under us
        if (key === 'draftAttachments') {
          obsolete.set(key, undefined);
        }
      }
    });

    if (obsolete.get('isPinned')) {
      obsolete.unpin();

      if (!current.get('isPinned')) {
        current.pin();
      }
    }

    const obsoleteId = obsolete.get('id');
    const obsoleteServiceId = obsolete.getServiceId();
    const currentId = current.get('id');

    if (conversationType === 'private' && obsoleteServiceId) {
      if (!current.get('profileKey') && obsolete.get('profileKey')) {
        log.warn(`${logId}: Copying profile key from old to new contact`);

        const profileKey = obsolete.get('profileKey');

        if (profileKey) {
          await current.setProfileKey(profileKey, {
            reason: 'doCombineConversations ',
          });
        }
      }

      log.warn(`${logId}: Delete all sessions tied to old conversationId`);
      // Note: we use the conversationId here in case we've already lost our service id.
      await window.textsecure.storage.protocol.removeSessionsByConversation(
        obsoleteId
      );

      log.warn(
        `${logId}: Delete all identity information tied to old conversationId`
      );
      if (obsoleteServiceId) {
        await window.textsecure.storage.protocol.removeIdentityKey(
          obsoleteServiceId
        );
      }

      log.warn(
        `${logId}: Ensure that all V1 groups have new conversationId instead of old`
      );
      const groups =
        await this.getAllGroupsInvolvingServiceId(obsoleteServiceId);
      groups.forEach(group => {
        const members = group.get('members');
        const withoutObsolete = without(members, obsoleteId);
        const currentAdded = uniq([...withoutObsolete, currentId]);

        group.set({
          members: currentAdded,
        });
        drop(updateConversation(group.attributes));
      });
    }

    // Note: we explicitly don't want to update V2 groups

    const obsoleteHadMessages = (obsolete.get('messageCount') ?? 0) > 0;

    log.warn(`${logId}: Delete the obsolete conversation from the database`);
    await removeConversation(obsoleteId);

    const obsoleteStorageID = obsolete.get('storageID');

    if (obsoleteStorageID) {
      log.warn(
        `${logId}: Obsolete conversation was in storage service, scheduling removal`
      );

      const obsoleteStorageVersion = obsolete.get('storageVersion');
      StorageService.addPendingDelete({
        storageID: obsoleteStorageID,
        storageVersion: obsoleteStorageVersion,
      });
    }

    log.warn(`${logId}: Update cached messages in MessageCache`);
    window.MessageCache.replaceAllObsoleteConversationIds({
      conversationId: currentId,
      obsoleteId,
    });
    log.warn(`${logId}: Update messages table`);
    await migrateConversationMessages(obsoleteId, currentId);

    log.warn(`${logId}: Emit refreshConversation event to close old/open new`);
    window.Whisper.events.trigger('refreshConversation', {
      newId: currentId,
      oldId: obsoleteId,
    });

    log.warn(
      `${logId}: Eliminate old conversation from ConversationController lookups`
    );
    this._conversations.remove(obsolete);
    this._conversations.resetLookups();

    current.captureChange('combineConversations');
    drop(current.updateLastMessage());

    const state = window.reduxStore.getState();
    if (state.conversations.selectedConversationId === current.id) {
      // TODO: DESKTOP-4807
      drop(current.loadNewestMessages(undefined, undefined));
    }

    const titleIsUseful = Boolean(
      obsoleteTitleInfo && getTitleNoDefault(obsoleteTitleInfo)
    );
    // If both conversations had messages - add merge
    if (
      titleIsUseful &&
      conversationType === 'private' &&
      currentHadMessages &&
      obsoleteHadMessages
    ) {
      assertDev(obsoleteTitleInfo, 'part of titleIsUseful boolean');

      drop(current.addConversationMerge(obsoleteTitleInfo));
    }

    log.warn(`${logId}: Complete!`);
  }

  /**
   * Given a groupId and optional additional initialization properties,
   * ensures the existence of a group conversation and returns a string
   * representing the local database ID of the group conversation.
   */
  ensureGroup(groupId: string, additionalInitProps = {}): string {
    return this.getOrCreate(groupId, 'group', additionalInitProps).get('id');
  }

  /**
   * Given certain metadata about a message (an identifier of who wrote the
   * message and the sent_at timestamp of the message) returns the
   * conversation the message belongs to OR null if a conversation isn't
   * found.
   */
  async getConversationForTargetMessage(
    targetFromId: string,
    targetTimestamp: number
  ): Promise<ConversationModel | null | undefined> {
    const messages = await getMessagesBySentAt(targetTimestamp);
    const targetMessage = messages.find(m => getAuthorId(m) === targetFromId);

    if (targetMessage) {
      return this.get(targetMessage.conversationId);
    }

    return null;
  }

  async getAllGroupsInvolvingServiceId(
    serviceId: ServiceIdString
  ): Promise<Array<ConversationModel>> {
    const groups = await getAllGroupsInvolvingServiceId(serviceId);
    return groups.map(group => {
      const existing = this.get(group.id);
      if (existing) {
        return existing;
      }

      return this._conversations.add(group);
    });
  }

  getByDerivedGroupV2Id(groupId: string): ConversationModel | undefined {
    return this._conversations.find(
      item => item.get('derivedGroupV2Id') === groupId
    );
  }

  setReadOnly(value: boolean): void {
    if (this.#isReadOnly === value) {
      log.warn(`ConversationController: already at readOnly=${value}`);
      return;
    }

    log.info(`ConversationController: readOnly=${value}`);
    this.#isReadOnly = value;
  }

  reset(): void {
    delete this._initialPromise;
    this.#_initialFetchComplete = false;
    this._conversations.reset([]);
  }

  load(): Promise<void> {
    this._initialPromise ||= this.#doLoad();
    return this._initialPromise;
  }

  // A number of things outside conversation.attributes affect conversation re-rendering.
  //   If it's scoped to a given conversation, it's easy to trigger('change'). There are
  //   important values in storage and the storage service which change rendering pretty
  //   radically, so this function is necessary to force regeneration of props.
  async forceRerender(identifiers?: Array<string>): Promise<void> {
    let count = 0;
    const conversations = identifiers
      ? identifiers.map(identifier => this.get(identifier)).filter(isNotNil)
      : this._conversations.models.slice();
    log.info(
      `forceRerender: Starting to loop through ${conversations.length} conversations`
    );

    for (let i = 0, max = conversations.length; i < max; i += 1) {
      const conversation = conversations[i];

      if (conversation.cachedProps) {
        conversation.oldCachedProps = conversation.cachedProps;
        conversation.cachedProps = null;

        conversation.trigger('props-change', conversation, false);
        count += 1;
      }

      if (count % 10 === 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(300);
      }
    }
    log.info(`forceRerender: Updated ${count} conversations`);
  }

  onConvoOpenStart(conversationId: string): void {
    this.#_conversationOpenStart.set(conversationId, Date.now());
  }

  onConvoMessageMount(conversationId: string): void {
    const loadStart = this.#_conversationOpenStart.get(conversationId);
    if (loadStart === undefined) {
      return;
    }

    this.#_conversationOpenStart.delete(conversationId);
    this.get(conversationId)?.onOpenComplete(loadStart);
  }

  repairPinnedConversations(): void {
    const pinnedIds = window.storage.get('pinnedConversationIds', []);

    for (const id of pinnedIds) {
      const convo = this.get(id);

      if (!convo || convo.get('isPinned')) {
        continue;
      }

      log.warn(
        `ConversationController: Repairing ${convo.idForLogging()}'s isPinned`
      );
      convo.set('isPinned', true);

      drop(updateConversation(convo.attributes));
    }
  }

  async clearShareMyPhoneNumber(): Promise<void> {
    const sharedWith = this.getAll().filter(c => c.get('shareMyPhoneNumber'));

    if (sharedWith.length === 0) {
      return;
    }

    log.info(
      'ConversationController.clearShareMyPhoneNumber: ' +
        `updating ${sharedWith.length} conversations`
    );

    await updateConversations(
      sharedWith.map(c => {
        c.unset('shareMyPhoneNumber');
        return c.attributes;
      })
    );
  }

  // For testing
  async _forgetE164(e164: string): Promise<void> {
    const { server } = window.textsecure;
    strictAssert(server, 'Server must be initialized');
    const { entries: serviceIdMap, transformedE164s } =
      await getServiceIdsForE164s(server, [e164]);

    const e164ToUse = transformedE164s.get(e164) ?? e164;
    const pni = serviceIdMap.get(e164ToUse)?.pni;

    log.info(`ConversationController: forgetting e164=${e164ToUse} pni=${pni}`);

    const convos = [this.get(e164ToUse), this.get(pni)];

    for (const convo of convos) {
      if (!convo) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await removeConversation(convo.id);
      this._conversations.remove(convo);
      this._conversations.resetLookups();
    }
  }

  async #doLoad(): Promise<void> {
    log.info('ConversationController: starting initial fetch');

    if (this._conversations.length) {
      throw new Error('ConversationController: Already loaded!');
    }

    try {
      const collection = await getAllConversations();

      // Get rid of temporary conversations
      const temporaryConversations = collection.filter(conversation =>
        Boolean(conversation.isTemporary)
      );

      if (temporaryConversations.length) {
        log.warn(
          `ConversationController: Removing ${temporaryConversations.length} temporary conversations`
        );
      }
      const queue = new PQueue({
        concurrency: 3,
        timeout: MINUTE * 30,
        throwOnTimeout: true,
      });
      drop(
        queue.addAll(
          temporaryConversations.map(item => async () => {
            await removeConversation(item.id);
          })
        )
      );
      await queue.onIdle();

      // It is alright to call it first because the 'add'/'update' events are
      // triggered after updating the collection.
      this.#_initialFetchComplete = true;

      // Hydrate the final set of conversations
      batchDispatch(() => {
        this._conversations.add(
          collection.filter(conversation => !conversation.isTemporary)
        );
      });

      await Promise.all(
        this._conversations.map(async conversation => {
          try {
            // Hydrate contactCollection, now that initial fetch is complete
            conversation.fetchContacts();

            const isChanged = maybeDeriveGroupV2Id(conversation);
            if (isChanged) {
              await updateConversation(conversation.attributes);
            }

            // In case a too-large draft was saved to the database
            const draft = conversation.get('draft');
            if (draft && draft.length > MAX_MESSAGE_BODY_LENGTH) {
              conversation.set({
                draft: draft.slice(0, MAX_MESSAGE_BODY_LENGTH),
              });
              await updateConversation(conversation.attributes);
            }

            // Clean up the conversations that have service id as their e164.
            const e164 = conversation.get('e164');
            const serviceId = conversation.getServiceId();
            if (e164 && isServiceIdString(e164) && serviceId) {
              conversation.set({ e164: undefined });
              await updateConversation(conversation.attributes);

              log.info(
                `Cleaning up conversation(${serviceId}) with invalid e164`
              );
            }
          } catch (error) {
            log.error(
              'ConversationController.load/map: Failed to prepare a conversation',
              Errors.toLogFormat(error)
            );
          }
        })
      );
      log.info(
        'ConversationController: done with initial fetch, ' +
          `got ${this._conversations.length} conversations`
      );
    } catch (error) {
      log.error(
        'ConversationController: initial fetch failed',
        Errors.toLogFormat(error)
      );
      throw error;
    }
  }
}
