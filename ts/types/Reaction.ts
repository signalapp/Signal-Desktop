import { EmojiSet, PartialI18n } from 'emoji-mart';

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

type BaseEmojiSkin = { unified: string; native: string };

export interface FixedBaseEmoji {
  id: string;
  name: string;
  keywords: Array<string>;
  skins: Array<BaseEmojiSkin>;
  version: number;
  search?: string;
  // props from emoji panel click event
  native?: string;
  aliases?: Array<string>;
  shortcodes?: string;
  unified?: string;
}

export interface NativeEmojiData {
  categories: Array<{ id: string; emojis: Array<string> }>;
  emojis: Record<string, FixedBaseEmoji>;
  aliases: Record<string, string>;
  sheet: { cols: number; rows: number };
  ariaLabels?: Record<string, string>;
}

// Types for EmojiMart 5 are currently broken these are a temporary fixes
export interface FixedPickerProps {
  autoFocus?: boolean | undefined;
  title?: string | undefined;
  theme?: 'auto' | 'light' | 'dark' | undefined;
  perLine?: number | undefined;
  stickySearch?: boolean | undefined;
  searchPosition?: 'sticky' | 'static' | 'none' | undefined;
  emojiButtonSize?: number | undefined;
  emojiButtonRadius?: number | undefined;
  emojiButtonColors?: string | undefined;
  maxFrequentRows?: number | undefined;
  icons?: 'auto' | 'outline' | 'solid';
  set?: EmojiSet | undefined;
  emoji?: string | undefined;
  navPosition?: 'bottom' | 'top' | 'none' | undefined;
  showPreview?: boolean | undefined;
  previewEmoji?: boolean | undefined;
  noResultsEmoji?: string | undefined;
  previewPosition?: 'bottom' | 'top' | 'none' | undefined;
  skinTonePosition?: 'preview' | 'search' | 'none';
  i18n?: PartialI18n | undefined;
  onEmojiSelect?: (emoji: FixedBaseEmoji) => void;
  onClickOutside?: () => void;
  onKeyDown?: (event: any) => void;
  onAddCustomEmoji?: () => void;
  getImageURL?: () => void;
  getSpritesheetURL?: () => void;
  // Below here I'm currently unsure of usage
  // style?: React.CSSProperties | undefined;
  // color?: string | undefined;
  // skin?: EmojiSkin | undefined;
  // defaultSkin?: EmojiSkin | undefined;
  // backgroundImageFn?: BackgroundImageFn | undefined;
  // sheetSize?: EmojiSheetSize | undefined;
  // emojisToShowFilter?(emoji: EmojiData): boolean;
  // showSkinTones?: boolean | undefined;
  // emojiTooltip?: boolean | undefined;
  // include?: CategoryName[] | undefined;
  // exclude?: CategoryName[] | undefined;
  // recent?: string[] | undefined;
  // /** NOTE: custom emoji are copied into a singleton object on every new mount */
  // custom?: CustomEmoji[] | undefined;
  // skinEmoji?: string | undefined;
  // notFound?(): React.Component;
  // notFoundEmoji?: string | undefined;
  // enableFrequentEmojiSort?: boolean | undefined;
  // useButton?: boolean | undefined;
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

// used for logic operations with reactions i.e reponses, db, etc.
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
