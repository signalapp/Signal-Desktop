// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Fuse from 'fuse.js';

import { ConversationType } from '../state/ducks/conversations';

const FUSE_OPTIONS = {
  location: 0,
  shouldSort: true,
  threshold: 0,
  maxPatternLength: 32,
  minMatchCharLength: 1,
  tokenize: true,
  keys: ['name', 'firstName', 'profileName', 'title'],
};

export class MemberRepository {
  private members: Array<ConversationType>;

  private fuse: Fuse<ConversationType>;

  constructor(members: Array<ConversationType> = []) {
    this.members = members;
    this.fuse = new Fuse<ConversationType>(this.members, FUSE_OPTIONS);
  }

  updateMembers(members: Array<ConversationType>): void {
    this.members = members;
    this.fuse = new Fuse(members, FUSE_OPTIONS);
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
    const results = this.fuse.search(`${pattern}`);

    if (omit) {
      return results.filter(({ id }) => id !== omit.id);
    }

    return results;
  }
}
