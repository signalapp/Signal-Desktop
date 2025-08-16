// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Fuse from 'fuse.js';
import { get } from 'lodash';

import type { ConversationType } from '../state/ducks/conversations';
import type { AciString } from '../types/ServiceId';
import { isAciString } from '../util/isAciString';
import { filter, map } from '../util/iterables';
import { removeDiacritics } from '../util/removeDiacritics';
import { isNotNil } from '../util/isNotNil';

export type MemberType = Omit<ConversationType, 'serviceId'> &
  Readonly<{
    aci: AciString;
  }>;

function toMember({
  serviceId,
  ...restOfConvo
}: ConversationType): MemberType | undefined {
  if (!isAciString(serviceId)) {
    return undefined;
  }

  return {
    ...restOfConvo,
    aci: serviceId,
  };
}

// Exported for testing
export function _toMembers(
  conversations: ReadonlyArray<ConversationType>
): Array<MemberType> {
  return conversations.map(toMember).filter(isNotNil);
}

const FUSE_OPTIONS = {
  location: 0,
  shouldSort: true,
  threshold: 0,
  maxPatternLength: 32,
  minMatchCharLength: 1,
  keys: ['name', 'firstName', 'profileName', 'title'],
  getFn(
    conversation: Readonly<MemberType>,
    path: string | Array<string>
  ): ReadonlyArray<string> | string {
    // It'd be nice to avoid this cast, but Fuse's types don't allow it.
    const rawValue = get(conversation as Record<string, unknown>, path);

    if (typeof rawValue !== 'string') {
      // It might make more sense to return `undefined` here, but [Fuse's types don't
      //   allow it in newer versions][0] so we just return the empty string.
      //
      // [0]: https://github.com/krisk/Fuse/blob/e5e3abb44e004662c98750d0964d2d9a73b87848/src/index.d.ts#L117
      return '';
    }

    const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
    const segments = segmenter.segment(removeDiacritics(rawValue));
    const wordlikeSegments = filter(segments, segment => segment.isWordLike);
    const wordlikes = map(wordlikeSegments, segment => segment.segment);
    return Array.from(wordlikes);
  },
};

export class MemberRepository {
  #members: ReadonlyArray<MemberType>;
  #isFuseReady = false;
  #fuse = new Fuse<MemberType>([], FUSE_OPTIONS);

  constructor(conversations: ReadonlyArray<ConversationType> = []) {
    this.#members = _toMembers(conversations);
  }

  updateMembers(conversations: ReadonlyArray<ConversationType>): void {
    this.#members = _toMembers(conversations);
    this.#isFuseReady = false;
  }

  getMembers(omitId?: string): ReadonlyArray<MemberType> {
    if (omitId) {
      return this.#members.filter(({ id }) => id !== omitId);
    }

    return this.#members;
  }

  getMemberById(id?: string): MemberType | undefined {
    return id
      ? this.#members.find(({ id: memberId }) => memberId === id)
      : undefined;
  }

  getMemberByAci(aci?: AciString): MemberType | undefined {
    return aci
      ? this.#members.find(({ aci: memberAci }) => memberAci === aci)
      : undefined;
  }

  search(pattern: string, omitId?: string): ReadonlyArray<MemberType> {
    if (!this.#isFuseReady) {
      this.#fuse.setCollection(this.#members);
      this.#isFuseReady = true;
    }

    const results = this.#fuse
      .search(removeDiacritics(pattern))
      .map(result => result.item);

    if (omitId) {
      return results.filter(({ id }) => id !== omitId);
    }

    return results;
  }
}
