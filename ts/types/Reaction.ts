import { Emoji, EmojiMartData } from '@emoji-mart/data';

export const reactionLimit: number = 6;

export class RecentReactions {
  public items: Array<string> = [];

  constructor(items: Array<string>) {
    this.items = items;
  }

  public size(): number {
    return this.items.length;
  }

  public push(item: string): void {
    if (this.size() === reactionLimit) {
      this.items.pop();
    }
    this.items.unshift(item);
  }

  public pop(): string | undefined {
    return this.items.pop();
  }

  public swap(index: number): void {
    const temp = this.items.splice(index, 1);
    this.push(temp[0]);
  }
}

export interface FixedBaseEmoji extends Emoji {
  search?: string;
  // props from emoji panel click event
  native?: string;
  aliases?: Array<string>;
  shortcodes?: string;
  unified?: string;
}

export interface NativeEmojiData extends EmojiMartData {
  ariaLabels?: Record<string, string>;
}

export enum Action {
  REACT = 0,
  REMOVE = 1,
}

export interface Reaction {
  // this is in fact a uint64 so we will have an issue
  id: number; // original message timestamp
  author: string;
  emoji: string;
  action: Action;
}

// used for logic operations with reactions i.e responses, db, etc.
export type ReactionList = Record<
  string,
  {
    count: number;
    index: number; // relies on reactsIndex in the message model
    senders: Array<string>;
    you: boolean; // whether we are in the senders list, used within 1-1 and closed groups for ignoring duplicate data messages, used within opengroups since we dont always have the full list of senders.
  }
>;

// used when rendering reactions to guarantee sorted order using the index
export type SortedReactionList = Array<
  [string, { count: number; index: number; senders: Array<string>; you?: boolean }]
>;

export interface OpenGroupReaction {
  index: number;
  count: number;
  you: boolean;
  reactors: Array<string>;
}

export type OpenGroupReactionList = Record<string, OpenGroupReaction>;

export interface OpenGroupReactionResponse {
  added?: boolean;
  removed?: boolean;
  seqno: number;
}
