// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Fuse from 'fuse.js';
import { get } from 'lodash';

import type { ConversationType } from '../state/ducks/conversations';
import { filter, map } from '../util/iterables';

const FUSE_OPTIONS = {
  location: 0,
  shouldSort: true,
  threshold: 0,
  maxPatternLength: 32,
  minMatchCharLength: 1,
  keys: ['name', 'firstName', 'profileName', 'title'],
  getFn(
    conversation: Readonly<ConversationType>,
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
    const segments = segmenter.segment(rawValue);
    const wordlikeSegments = filter(segments, segment => segment.isWordLike);
    const wordlikes = map(wordlikeSegments, segment => segment.segment);
    return Array.from(wordlikes);
  },
};

export class MemberRepository {
  private isFuseReady = false;

  private fuse: Fuse<ConversationType> = new Fuse<ConversationType>(
    [],
    FUSE_OPTIONS
  );

  constructor(private members: Array<ConversationType> = []) {}

  updateMembers(members: Array<ConversationType>): void {
    this.members = members;
    this.isFuseReady = false;
  }

  getMembers(omit?: ConversationType): Array<ConversationType> {
    if (omit) {
      return this.members.filter(({ id }) => id !== omit.id);
    }

    return this.members;
  }

  getMemberById(id?: string): ConversationType | undefined {
    return id
      ? this.members.find(({ id: memberId }) => memberId === id)
      : undefined;
  }

  getMemberByUuid(uuid?: string): ConversationType | undefined {
    return uuid
      ? this.members.find(({ uuid: memberUuid }) => memberUuid === uuid)
      : undefined;
  }

  search(pattern: string, omit?: ConversationType): Array<ConversationType> {
    if (!this.isFuseReady) {
      this.fuse.setCollection(this.members);
      this.isFuseReady = true;
    }

    const results = this.fuse.search(pattern).map(result => result.item);

    if (omit) {
      return results.filter(({ id }) => id !== omit.id);
    }

    return results;
  }
}
