// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react/jsx-pascal-case */

import type {
  DetailedHTMLProps,
  HTMLAttributes,
  ReactNode,
  RefObject,
} from 'react';
import React, { forwardRef, useRef } from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import getDirection from 'direction';
import lodash from 'lodash';
import { Manager, Popper, Reference } from 'react-popper';
import type { PreventOverflowModifier } from '@popperjs/core/lib/modifiers/preventOverflow.js';
import type { ReadonlyDeep } from 'type-fest';
import type {
  ConversationType,
  ConversationTypeType,
  InteractionModeType,
  PushPanelForConversationActionType,
  SaveAttachmentActionCreatorType,
  SaveAttachmentsActionCreatorType,
  ShowConversationType,
} from '../../state/ducks/conversations.preload.js';
import type { ViewStoryActionCreatorType } from '../../state/ducks/stories.preload.js';
import { ReadStatus } from '../../messages/MessageReadStatus.std.js';
import { Avatar, AvatarSize } from '../Avatar.dom.js';
import { AvatarSpacer } from '../AvatarSpacer.dom.js';
import { MessageBodyReadMore } from './MessageBodyReadMore.dom.js';
import { MessageMetadata } from './MessageMetadata.dom.js';
import { MessageTextMetadataSpacer } from './MessageTextMetadataSpacer.dom.js';
import { ImageGrid } from './ImageGrid.dom.js';
import { GIF } from './GIF.dom.js';
import { CurveType, Image } from './Image.dom.js';
import { ContactName } from './ContactName.dom.js';
import type { QuotedAttachmentForUIType } from './Quote.dom.js';
import { Quote } from './Quote.dom.js';
import { EmbeddedContact } from './EmbeddedContact.dom.js';
import type {
  OwnProps as ReactionViewerProps,
  Reaction,
} from './ReactionViewer.dom.js';
import { ReactionViewer } from './ReactionViewer.dom.js';
import { LinkPreviewDate } from './LinkPreviewDate.dom.js';
import type { LinkPreviewForUIType } from '../../types/message/LinkPreviews.std.js';
import type { MessageStatusType } from '../../types/message/MessageStatus.std.js';
import { shouldUseFullSizeLinkPreviewImage } from '../../linkPreviews/shouldUseFullSizeLinkPreviewImage.std.js';
import type { WidthBreakpoint } from '../_util.std.js';
import { OutgoingGiftBadgeModal } from '../OutgoingGiftBadgeModal.dom.js';
import { createLogger } from '../../logging/log.std.js';
import { StoryViewModeType } from '../../types/Stories.std.js';
import { GiftBadgeStates } from '../../types/GiftBadgeStates.std.js';
import type {
  AttachmentForUIType,
  AttachmentType,
} from '../../types/Attachment.std.js';
import {
  canDisplayImage,
  getGridDimensions,
  getImageDimensionsForTimeline,
  hasImage,
  hasVideoScreenshot,
  isAudio,
  isDownloaded,
  isDownloading,
  isGIF,
  isImage,
  isImageAttachment,
  isPlayed,
  isVideo,
} from '../../util/Attachment.std.js';
import type { EmbeddedContactForUIType } from '../../types/EmbeddedContact.std.js';

import { getIncrement } from '../../util/timer.std.js';
import { clearTimeoutIfNecessary } from '../../util/clearTimeoutIfNecessary.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import type { HydratedBodyRangesType } from '../../types/BodyRange.std.js';
import type { LocalizerType, ThemeType } from '../../types/Util.std.js';

import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.js';
import type {
  ContactNameColorType,
  ConversationColorType,
  CustomColorType,
} from '../../types/Colors.std.js';
import { createRefMerger } from '../../util/refMerger.std.js';
import { getCustomColorStyle } from '../../util/getCustomColorStyle.dom.js';
import type { ServiceIdString } from '../../types/ServiceId.std.js';
import { DAY, HOUR, MINUTE, SECOND } from '../../util/durations/index.std.js';
import { BadgeImageTheme } from '../../badges/BadgeImageTheme.std.js';
import { getBadgeImageFileLocalPath } from '../../badges/getBadgeImageFileLocalPath.std.js';
import { handleOutsideClick } from '../../util/handleOutsideClick.dom.js';
import { isPaymentNotificationEvent } from '../../types/Payment.std.js';
import type { AnyPaymentEvent } from '../../types/Payment.std.js';
import { getPaymentEventDescription } from '../../messages/payments.std.js';
import { PanelType } from '../../types/Panels.std.js';
import { isPollReceiveEnabled } from '../../types/Polls.dom.js';
import type { PollWithResolvedVotersType } from '../../state/selectors/message.preload.js';
import { PollMessageContents } from './poll-message/PollMessageContents.dom.js';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.js';
import { RenderLocation } from './MessageTextRenderer.dom.js';
import { UserText } from '../UserText.dom.js';
import { getColorForCallLink } from '../../util/getColorForCallLink.std.js';
import { getKeyFromCallLink } from '../../util/callLinks.std.js';
import { InAnotherCallTooltip } from './InAnotherCallTooltip.dom.js';
import { formatFileSize } from '../../util/formatFileSize.std.js';
import { assertDev, strictAssert } from '../../util/assert.std.js';
import { AttachmentStatusIcon } from './AttachmentStatusIcon.dom.js';
import { TapToViewNotAvailableType } from '../TapToViewNotAvailableModal.dom.js';
import type { DataPropsType as TapToViewNotAvailablePropsType } from '../TapToViewNotAvailableModal.dom.js';
import { FileThumbnail } from '../FileThumbnail.dom.js';
import { FunStaticEmoji } from '../fun/FunEmoji.dom.js';
import {
  type EmojifyData,
  getEmojifyData,
  getEmojiParentByKey,
  getEmojiParentKeyByVariantKey,
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from '../fun/data/emojis.std.js';
import { useGroupedAndOrderedReactions } from '../../util/groupAndOrderReactions.dom.js';

const { drop, take, unescape } = lodash;

const log = createLogger('Message');

const EXPIRATION_CHECK_MINIMUM = 2000;
const EXPIRED_DELAY = 600;
const GROUP_AVATAR_SIZE = AvatarSize.TWENTY_EIGHT;
const STICKER_SIZE = 200;
const GIF_SIZE = 300;
// Note: this needs to match the animation time
const TARGETED_TIMEOUT = 1200;
const SENT_STATUSES = new Set<MessageStatusType>([
  'delivered',
  'read',
  'sent',
  'viewed',
]);
const GIFT_BADGE_UPDATE_INTERVAL = 30 * SECOND;

enum MetadataPlacement {
  NotRendered,
  RenderedElsewhere,
  InlineWithText,
  Bottom,
}

export enum TextDirection {
  LeftToRight = 'LeftToRight',
  RightToLeft = 'RightToLeft',
  Default = 'Default',
  None = 'None',
}

const TextDirectionToDirAttribute = {
  [TextDirection.LeftToRight]: 'ltr',
  [TextDirection.RightToLeft]: 'rtl',
  [TextDirection.Default]: 'auto',
  [TextDirection.None]: 'auto',
};

export const Directions = ['incoming', 'outgoing'] as const;
export type DirectionType = (typeof Directions)[number];

export type AudioAttachmentProps = {
  renderingContext: string;
  i18n: LocalizerType;
  buttonRef: React.RefObject<HTMLButtonElement>;
  theme: ThemeType | undefined;
  attachment: AttachmentForUIType;
  collapseMetadata: boolean;
  withContentAbove: boolean;
  withContentBelow: boolean;

  direction: DirectionType;
  expirationLength?: number;
  expirationTimestamp?: number;
  id: string;
  conversationId: string;
  played: boolean;
  pushPanelForConversation: PushPanelForConversationActionType;
  status?: MessageStatusType;
  textPending?: boolean;
  timestamp: number;

  kickOffAttachmentDownload(): void;
  cancelAttachmentDownload(): void;
  onCorrupted(): void;
};

export type GiftBadgeType =
  | {
      state:
        | GiftBadgeStates.Unopened
        | GiftBadgeStates.Opened
        | GiftBadgeStates.Redeemed;
      expiration: number;
      id: string | undefined;
      level: number;
    }
  | {
      state: GiftBadgeStates.Failed;
    };

function ReactionEmoji(props: { emojiVariantValue: string }) {
  strictAssert(
    isEmojiVariantValue(props.emojiVariantValue),
    'Expected a valid emoji variant value'
  );
  const emojiVariantKey = getEmojiVariantKeyByValue(props.emojiVariantValue);
  const emojiVariant = getEmojiVariantByKey(emojiVariantKey);
  const emojiParentKey = getEmojiParentKeyByVariantKey(emojiVariantKey);
  const emojiParent = getEmojiParentByKey(emojiParentKey);

  return (
    <FunStaticEmoji
      role="img"
      aria-label={emojiParent.englishShortNameDefault}
      size={16}
      emoji={emojiVariant}
    />
  );
}

export type PropsData = {
  id: string;
  renderingContext: string;
  contactNameColor?: ContactNameColorType;
  conversationColor: ConversationColorType;
  conversationTitle: string;
  customColor?: CustomColorType;
  conversationId: string;
  displayLimit?: number;
  activeCallConversationId?: string;
  text?: string;
  textDirection: TextDirection;
  textAttachment?: AttachmentForUIType;
  isEditedMessage?: boolean;
  isSticker?: boolean;
  isTargeted?: boolean;
  isTargetedCounter?: number;
  isSelected: boolean;
  isSelectMode: boolean;
  isSMS: boolean;
  isSpoilerExpanded?: Record<number, boolean>;
  direction: DirectionType;
  timestamp: number;
  receivedAtMS?: number;
  status?: MessageStatusType;
  contact?: ReadonlyDeep<EmbeddedContactForUIType>;
  author: Pick<
    ConversationType,
    | 'avatarPlaceholderGradient'
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'badges'
    | 'color'
    | 'firstName'
    | 'hasAvatar'
    | 'id'
    | 'isMe'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
  >;
  conversationType: ConversationTypeType;
  attachments?: ReadonlyArray<AttachmentForUIType>;
  giftBadge?: GiftBadgeType;
  payment?: AnyPaymentEvent;
  poll?: PollWithResolvedVotersType;
  quote?: {
    conversationColor: ConversationColorType;
    conversationTitle: string;
    customColor?: CustomColorType;
    text: string;
    rawAttachment?: QuotedAttachmentForUIType;
    payment?: AnyPaymentEvent;
    isFromMe: boolean;
    sentAt: number;
    authorId: string;
    authorPhoneNumber?: string;
    authorProfileName?: string;
    authorTitle: string;
    authorName?: string;
    bodyRanges?: HydratedBodyRangesType;
    referencedMessageNotFound: boolean;
    isViewOnce: boolean;
    isGiftBadge: boolean;
  };
  storyReplyContext?: {
    authorTitle: string;
    conversationColor: ConversationColorType;
    customColor?: CustomColorType;
    emoji?: string;
    isFromMe: boolean;
    rawAttachment?: QuotedAttachmentForUIType;
    storyId?: string;
    text: string;
  };
  previews: ReadonlyArray<LinkPreviewForUIType>;

  isTapToView?: boolean;
  isTapToViewExpired?: boolean;
  isTapToViewError?: boolean;

  readStatus?: ReadStatus;

  expirationLength?: number;
  expirationTimestamp?: number;

  reactions?: ReactionViewerProps['reactions'];

  deletedForEveryone?: boolean;
  attachmentDroppedDueToSize?: boolean;

  canDeleteForEveryone: boolean;
  isBlocked: boolean;
  isMessageRequestAccepted: boolean;
  bodyRanges?: HydratedBodyRangesType;

  renderMenu?: () => JSX.Element | undefined;

  item?: never;
  // test-only, to force GIF's reduced motion experience
  _forceTapToPlay?: boolean;
};

export type PropsHousekeeping = {
  containerElementRef: RefObject<HTMLElement>;
  containerWidthBreakpoint: WidthBreakpoint;
  disableScroll?: boolean;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  interactionMode: InteractionModeType;
  platform: string;
  renderAudioAttachment: (props: AudioAttachmentProps) => JSX.Element;
  shouldCollapseAbove: boolean;
  shouldCollapseBelow: boolean;
  shouldHideMetadata: boolean;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  theme: ThemeType;
};

export type PropsActions = {
  clearTargetedMessage: () => unknown;
  doubleCheckMissingQuoteReference: (messageId: string) => unknown;
  messageExpanded: (id: string, displayLimit: number) => unknown;
  checkForAccount: (phoneNumber: string) => unknown;

  startConversation: (e164: string, serviceId: ServiceIdString) => void;
  showConversation: ShowConversationType;
  openGiftBadge: (messageId: string) => void;
  pushPanelForConversation: PushPanelForConversationActionType;
  retryMessageSend: (messageId: string) => unknown;
  sendPollVote: (params: {
    messageId: string;
    optionIndexes: ReadonlyArray<number>;
  }) => void;
  showContactModal: (contactId: string, conversationId?: string) => void;
  showSpoiler: (messageId: string, data: Record<number, boolean>) => void;

  cancelAttachmentDownload: (options: { messageId: string }) => void;
  kickOffAttachmentDownload: (options: { messageId: string }) => void;
  markAttachmentAsCorrupted: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  saveAttachment: SaveAttachmentActionCreatorType;
  saveAttachments: SaveAttachmentsActionCreatorType;
  showLightbox: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  showLightboxForViewOnceMedia: (messageId: string) => unknown;

  scrollToQuotedMessage: (options: {
    authorId: string;
    conversationId: string;
    sentAt: number;
  }) => void;
  targetMessage?: (messageId: string, conversationId: string) => unknown;

  showEditHistoryModal?: (id: string) => unknown;
  showAttachmentDownloadStillInProgressToast: (count: number) => unknown;
  showExpiredIncomingTapToViewToast: () => unknown;
  showExpiredOutgoingTapToViewToast: () => unknown;
  showMediaNoLongerAvailableToast: () => unknown;
  showTapToViewNotAvailableModal: (
    props: TapToViewNotAvailablePropsType
  ) => void;
  viewStory: ViewStoryActionCreatorType;

  onToggleSelect: (selected: boolean, shift: boolean) => void;
  onReplyToMessage: () => void;
};

export type Props = PropsData & PropsHousekeeping & PropsActions;

type State = {
  metadataWidth: number;

  expiring: boolean;
  expired: boolean;
  imageBroken: boolean;

  isTargeted?: boolean;
  prevTargetedCounter?: number;

  reactionViewerRoot: HTMLDivElement | null;
  reactionViewerOutsideClickDestructor?: () => void;

  giftBadgeCounter: number | null;
  showOutgoingGiftBadgeModal: boolean;

  hasDeleteForEveryoneTimerExpired: boolean;
};

// Function component for reactions that can use hooks
type MessageReactionsProps = {
  reactions: Array<Reaction>;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  theme: ThemeType;
  outgoing: boolean;
  toggleReactionViewer: (onlyRemove?: boolean) => void;
  reactionViewerRoot: HTMLDivElement | null;
  popperPreventOverflowModifier: () => Partial<PreventOverflowModifier>;
};

const MessageReactions = forwardRef(function MessageReactions(
  {
    reactions,
    getPreferredBadge,
    i18n,
    theme,
    outgoing,
    toggleReactionViewer,
    reactionViewerRoot,
    popperPreventOverflowModifier,
  }: MessageReactionsProps,
  parentRef
): JSX.Element {
  const ordered = useGroupedAndOrderedReactions(reactions, 'parentKey');

  const reactionsContainerRefMerger = useRef(createRefMerger());

  // Take the first three groups for rendering
  const toRender = take(ordered, 3).map(res => {
    const isMe = res.some(re => Boolean(re.from.isMe));
    const count = res.length;
    const { emoji } = res[0];

    let label: string;
    if (isMe) {
      label = i18n('icu:Message__reaction-emoji-label--you', { emoji });
    } else if (count === 1) {
      label = i18n('icu:Message__reaction-emoji-label--single', {
        title: res[0].from.title,
        emoji,
      });
    } else {
      label = i18n('icu:Message__reaction-emoji-label--many', {
        count,
        emoji,
      });
    }

    return {
      count,
      emoji,
      isMe,
      label,
    };
  });
  const someNotRendered = ordered.length > 3;
  // We only drop two here because the third emoji would be replaced by the
  // more button
  const maybeNotRendered = drop(ordered, 2);
  const maybeNotRenderedTotal = maybeNotRendered.reduce(
    (sum, res) => sum + res.length,
    0
  );
  const notRenderedIsMe =
    someNotRendered &&
    maybeNotRendered.some(res => res.some(re => Boolean(re.from.isMe)));

  const popperPlacement = outgoing ? 'bottom-end' : 'bottom-start';

  return (
    <Manager>
      <Reference>
        {({ ref: popperRef }) => (
          <div
            ref={reactionsContainerRefMerger.current(parentRef, popperRef)}
            className={classNames(
              'module-message__reactions',
              outgoing
                ? 'module-message__reactions--outgoing'
                : 'module-message__reactions--incoming'
            )}
            onDoubleClick={ev => {
              ev.stopPropagation();
            }}
          >
            {toRender.map((re, i) => {
              const isLast = i === toRender.length - 1;
              const isMore = isLast && someNotRendered;
              const isMoreWithMe = isMore && notRenderedIsMe;

              return (
                <button
                  aria-label={re.label}
                  type="button"
                  // eslint-disable-next-line react/no-array-index-key
                  key={`${re.emoji}-${i}`}
                  className={classNames(
                    'module-message__reactions__reaction',
                    re.count > 1
                      ? 'module-message__reactions__reaction--with-count'
                      : null,
                    outgoing
                      ? 'module-message__reactions__reaction--outgoing'
                      : 'module-message__reactions__reaction--incoming',
                    isMoreWithMe || (re.isMe && !isMoreWithMe)
                      ? 'module-message__reactions__reaction--is-me'
                      : null
                  )}
                  onClick={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    toggleReactionViewer(false);
                  }}
                  onKeyDown={e => {
                    // Prevent enter key from opening stickers/attachments
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                    }
                  }}
                >
                  {isMore ? (
                    <span
                      className={classNames(
                        'module-message__reactions__reaction__count',
                        'module-message__reactions__reaction__count--no-emoji',
                        isMoreWithMe
                          ? 'module-message__reactions__reaction__count--is-me'
                          : null
                      )}
                    >
                      +{maybeNotRenderedTotal}
                    </span>
                  ) : (
                    <>
                      <ReactionEmoji emojiVariantValue={re.emoji} />
                      {re.count > 1 ? (
                        <span
                          className={classNames(
                            'module-message__reactions__reaction__count',
                            re.isMe
                              ? 'module-message__reactions__reaction__count--is-me'
                              : null
                          )}
                        >
                          {re.count}
                        </span>
                      ) : null}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Reference>
      {reactionViewerRoot &&
        createPortal(
          <Popper
            placement={popperPlacement}
            strategy="fixed"
            modifiers={[popperPreventOverflowModifier()]}
          >
            {({ ref, style }) => (
              <ReactionViewer
                ref={ref}
                style={{
                  ...style,
                  zIndex: 2,
                }}
                getPreferredBadge={getPreferredBadge}
                reactions={reactions}
                i18n={i18n}
                onClose={toggleReactionViewer}
                theme={theme}
              />
            )}
          </Popper>,
          reactionViewerRoot
        )}
    </Manager>
  );
});

export class Message extends React.PureComponent<Props, State> {
  public focusRef: React.RefObject<HTMLDivElement> = React.createRef();

  public audioButtonRef: React.RefObject<HTMLButtonElement> = React.createRef();

  public reactionsContainerRef: React.RefObject<HTMLDivElement> =
    React.createRef();

  #hasSelectedTextRef: React.MutableRefObject<boolean> = {
    current: false,
  };

  #metadataRef: React.RefObject<HTMLDivElement> = React.createRef();

  public expirationCheckInterval: NodeJS.Timeout | undefined;

  public giftBadgeInterval: NodeJS.Timeout | undefined;

  public expiredTimeout: NodeJS.Timeout | undefined;

  public targetedTimeout: NodeJS.Timeout | undefined;

  public deleteForEveryoneTimeout: NodeJS.Timeout | undefined;

  public constructor(props: Props) {
    super(props);

    this.state = {
      metadataWidth: 0,

      expiring: false,
      expired: false,
      imageBroken: false,

      isTargeted: props.isTargeted,
      prevTargetedCounter: props.isTargetedCounter,

      reactionViewerRoot: null,

      giftBadgeCounter: null,
      showOutgoingGiftBadgeModal: false,

      hasDeleteForEveryoneTimerExpired:
        this.#getTimeRemainingForDeleteForEveryone() <= 0,
    };
  }

  public static getDerivedStateFromProps(props: Props, state: State): State {
    if (!props.isTargeted) {
      return {
        ...state,
        isTargeted: false,
        prevTargetedCounter: 0,
      };
    }

    if (
      props.isTargeted &&
      props.isTargetedCounter !== state.prevTargetedCounter
    ) {
      return {
        ...state,
        isTargeted: props.isTargeted,
        prevTargetedCounter: props.isTargetedCounter,
      };
    }

    return state;
  }

  #hasReactions(): boolean {
    const { reactions } = this.props;
    return Boolean(reactions && reactions.length);
  }

  public handleFocus = (): void => {
    const { interactionMode, isTargeted } = this.props;

    if (interactionMode === 'keyboard' && !isTargeted) {
      this.setTargeted();
    }
  };

  public handleImageError = (): void => {
    const { id } = this.props;
    log.info(`${id}: Image failed to load; failing over to placeholder`);
    this.setState({
      imageBroken: true,
    });
  };

  public setTargeted = (): void => {
    const { id, conversationId, targetMessage } = this.props;

    if (targetMessage) {
      targetMessage(id, conversationId);
    }
  };

  public setFocus = (): void => {
    const container = this.focusRef.current;

    if (container && !container.contains(document.activeElement)) {
      container.focus();
    }
  };

  public override componentDidMount(): void {
    const { conversationId } = this.props;
    window.ConversationController?.onConvoMessageMount(conversationId);

    this.startTargetedTimer();
    this.#startDeleteForEveryoneTimerIfApplicable();
    this.startGiftBadgeInterval();

    if (this.#metadataRef.current) {
      this.#updateMetadataWidth(this.#metadataRef.current.offsetWidth);
    }

    const { isTargeted } = this.props;
    if (isTargeted) {
      this.setFocus();
    }

    const { expirationLength } = this.props;
    if (expirationLength) {
      const increment = getIncrement(expirationLength);
      const checkFrequency = Math.max(EXPIRATION_CHECK_MINIMUM, increment);

      this.checkExpired();

      this.expirationCheckInterval = setInterval(() => {
        this.checkExpired();
      }, checkFrequency);
    }

    const { contact, checkForAccount } = this.props;
    if (contact && contact.firstNumber && !contact.serviceId) {
      checkForAccount(contact.firstNumber);
    }

    document.addEventListener('selectionchange', this.#handleSelectionChange);
  }

  public override componentWillUnmount(): void {
    clearTimeoutIfNecessary(this.targetedTimeout);
    clearTimeoutIfNecessary(this.expirationCheckInterval);
    clearTimeoutIfNecessary(this.expiredTimeout);
    clearTimeoutIfNecessary(this.deleteForEveryoneTimeout);
    clearTimeoutIfNecessary(this.giftBadgeInterval);
    this.toggleReactionViewer(true);
    document.removeEventListener(
      'selectionchange',
      this.#handleSelectionChange
    );
  }

  public override componentDidUpdate(prevProps: Readonly<Props>): void {
    const { isTargeted, status, timestamp } = this.props;

    this.startTargetedTimer();
    this.#startDeleteForEveryoneTimerIfApplicable();

    if (!prevProps.isTargeted && isTargeted) {
      this.setFocus();
    }

    this.checkExpired();

    if (
      prevProps.status === 'sending' &&
      (status === 'sent' ||
        status === 'delivered' ||
        status === 'read' ||
        status === 'viewed')
    ) {
      const delta = Date.now() - timestamp;
      window.SignalCI?.handleEvent('message:send-complete', {
        timestamp,
        delta,
      });
      log.info(
        `tsx: Rendered 'send complete' for message ${timestamp}; took ${delta}ms`
      );
    }
  }

  #getMetadataPlacement(
    {
      attachmentDroppedDueToSize,
      attachments,
      deletedForEveryone,
      direction,
      expirationLength,
      expirationTimestamp,
      giftBadge,
      i18n,
      isTapToView,
      isTapToViewError,
      isTapToViewExpired,
      readStatus,
      shouldHideMetadata,
      status,
      text,
    }: Readonly<Props> = this.props
  ): MetadataPlacement {
    const { imageBroken } = this.state;

    if (
      !expirationLength &&
      !expirationTimestamp &&
      (!status || SENT_STATUSES.has(status)) &&
      shouldHideMetadata
    ) {
      return MetadataPlacement.NotRendered;
    }

    if (giftBadge) {
      const description =
        direction === 'incoming'
          ? i18n('icu:message--donation--unopened--incoming')
          : i18n('icu:message--donation--unopened--outgoing');
      const isDescriptionRTL = getDirection(description) === 'rtl';

      if (giftBadge.state === GiftBadgeStates.Unopened && !isDescriptionRTL) {
        return MetadataPlacement.InlineWithText;
      }

      return MetadataPlacement.Bottom;
    }

    if (isTapToView) {
      if (
        readStatus !== ReadStatus.Viewed &&
        direction !== 'outgoing' &&
        (isTapToViewExpired || isTapToViewError)
      ) {
        return MetadataPlacement.Bottom;
      }

      return MetadataPlacement.RenderedElsewhere;
    }

    if (!text && !deletedForEveryone && !attachmentDroppedDueToSize) {
      const firstAttachment = attachments && attachments[0];
      const isAttachmentNotAvailable =
        firstAttachment?.isPermanentlyUndownloadable;

      if (this.isGenericAttachment(attachments, imageBroken)) {
        return MetadataPlacement.RenderedElsewhere;
      }

      if (isAudio(attachments) && !isAttachmentNotAvailable) {
        return MetadataPlacement.RenderedElsewhere;
      }

      return MetadataPlacement.Bottom;
    }

    if (!text && attachmentDroppedDueToSize) {
      return MetadataPlacement.InlineWithText;
    }

    if (this.#canRenderStickerLikeEmoji()) {
      return MetadataPlacement.Bottom;
    }

    if (this.#shouldShowJoinButton()) {
      return MetadataPlacement.Bottom;
    }

    return MetadataPlacement.InlineWithText;
  }

  public startTargetedTimer(): void {
    const { clearTargetedMessage, interactionMode } = this.props;
    const { isTargeted } = this.state;

    if (interactionMode === 'keyboard' || !isTargeted) {
      return;
    }

    if (!this.targetedTimeout) {
      this.targetedTimeout = setTimeout(() => {
        this.targetedTimeout = undefined;
        this.setState({ isTargeted: false });
        clearTargetedMessage();
      }, TARGETED_TIMEOUT);
    }
  }

  public startGiftBadgeInterval(): void {
    const { giftBadge } = this.props;

    if (!giftBadge) {
      return;
    }

    this.giftBadgeInterval = setInterval(() => {
      this.updateGiftBadgeCounter();
    }, GIFT_BADGE_UPDATE_INTERVAL);
  }

  public updateGiftBadgeCounter(): void {
    this.setState((state: State) => ({
      giftBadgeCounter: (state.giftBadgeCounter || 0) + 1,
    }));
  }

  #getTimeRemainingForDeleteForEveryone(): number {
    const { timestamp } = this.props;
    return Math.max(timestamp - Date.now() + DAY, 0);
  }

  #startDeleteForEveryoneTimerIfApplicable(): void {
    const { canDeleteForEveryone } = this.props;
    const { hasDeleteForEveryoneTimerExpired } = this.state;
    if (
      !canDeleteForEveryone ||
      hasDeleteForEveryoneTimerExpired ||
      this.deleteForEveryoneTimeout
    ) {
      return;
    }

    this.deleteForEveryoneTimeout = setTimeout(() => {
      this.setState({ hasDeleteForEveryoneTimerExpired: true });
      delete this.deleteForEveryoneTimeout;
    }, this.#getTimeRemainingForDeleteForEveryone());
  }

  public checkExpired(): void {
    const now = Date.now();
    const { expirationTimestamp, expirationLength } = this.props;

    if (!expirationTimestamp || !expirationLength) {
      return;
    }
    if (this.expiredTimeout) {
      return;
    }

    if (now >= expirationTimestamp) {
      this.setState({
        expiring: true,
      });

      const setExpired = () => {
        this.setState({
          expired: true,
        });
      };
      this.expiredTimeout = setTimeout(setExpired, EXPIRED_DELAY);
    }
  }

  #areLinksEnabled(): boolean {
    const { isMessageRequestAccepted, isBlocked } = this.props;
    return isMessageRequestAccepted && !isBlocked;
  }

  #shouldRenderAuthor(): boolean {
    const { author, conversationType, direction, shouldCollapseAbove } =
      this.props;
    return Boolean(
      direction === 'incoming' &&
        conversationType === 'group' &&
        author.title &&
        !shouldCollapseAbove
    );
  }

  #cachedEmojifyData: EmojifyData | null = null;

  #canRenderStickerLikeEmoji(): boolean {
    const {
      attachments,
      bodyRanges,
      previews,
      quote,
      storyReplyContext,
      text,
    } = this.props;

    if (
      text == null ||
      quote != null ||
      storyReplyContext != null ||
      (attachments != null && attachments.length > 0) ||
      (bodyRanges != null && bodyRanges.length > 0) ||
      (previews != null && previews.length > 0)
    ) {
      return false;
    }

    if (
      this.#cachedEmojifyData == null ||
      this.#cachedEmojifyData.text !== text
    ) {
      this.#cachedEmojifyData = getEmojifyData(text);
    }
    const emojifyData = this.#cachedEmojifyData;

    if (
      !emojifyData.isEmojiOnlyText ||
      emojifyData.emojiCount === 0 ||
      emojifyData.emojiCount >= 6
    ) {
      return false;
    }

    return true;
  }

  #updateMetadataWidth = (newMetadataWidth: number): void => {
    this.setState(({ metadataWidth }) => ({
      // We don't want text to jump around if the metadata shrinks, but we want to make
      //   sure we have enough room.
      metadataWidth: Math.ceil(Math.max(metadataWidth, newMetadataWidth)),
    }));
  };

  #handleSelectionChange = () => {
    const selection = document.getSelection();
    if (selection != null && !selection.isCollapsed) {
      this.#hasSelectedTextRef.current = true;
    }
  };

  #renderMetadata(): ReactNode {
    let isInline: boolean;
    const metadataPlacement = this.#getMetadataPlacement();
    switch (metadataPlacement) {
      case MetadataPlacement.NotRendered:
      case MetadataPlacement.RenderedElsewhere:
        return null;
      case MetadataPlacement.InlineWithText:
        isInline = true;
        break;
      case MetadataPlacement.Bottom:
        isInline = false;
        break;
      default:
        throw missingCaseError(metadataPlacement);
    }

    const {
      attachmentDroppedDueToSize,
      deletedForEveryone,
      direction,
      expirationLength,
      expirationTimestamp,
      i18n,
      id,
      isEditedMessage,
      isSMS,
      isSticker,
      retryMessageSend,
      pushPanelForConversation,
      showEditHistoryModal,
      status,
      text,
      textAttachment,
      timestamp,
    } = this.props;

    const isStickerLike = isSticker || this.#canRenderStickerLikeEmoji();

    return (
      <MessageMetadata
        deletedForEveryone={deletedForEveryone}
        direction={direction}
        expirationLength={expirationLength}
        expirationTimestamp={expirationTimestamp}
        hasText={Boolean(text || attachmentDroppedDueToSize)}
        i18n={i18n}
        id={id}
        isEditedMessage={isEditedMessage}
        isSMS={isSMS}
        isInline={isInline}
        isOutlineOnlyBubble={
          deletedForEveryone || (attachmentDroppedDueToSize && !text)
        }
        isShowingImage={this.isShowingImage()}
        isSticker={isStickerLike}
        onWidthMeasured={isInline ? this.#updateMetadataWidth : undefined}
        pushPanelForConversation={pushPanelForConversation}
        ref={this.#metadataRef}
        retryMessageSend={retryMessageSend}
        showEditHistoryModal={showEditHistoryModal}
        status={status}
        textPending={textAttachment?.pending}
        timestamp={timestamp}
      />
    );
  }

  #renderAuthor(): ReactNode {
    const { author, contactNameColor, i18n, isSticker } = this.props;

    if (!this.#shouldRenderAuthor()) {
      return null;
    }

    const stickerSuffix = isSticker ? '_with_sticker' : '';
    const moduleName = `module-message__author${stickerSuffix}`;

    return (
      <div className={moduleName}>
        <ContactName
          contactNameColor={contactNameColor}
          title={author.isMe ? i18n('icu:you') : author.title}
          module={moduleName}
        />
      </div>
    );
  }

  public renderAttachment(): JSX.Element | null {
    const {
      _forceTapToPlay,
      attachmentDroppedDueToSize,
      attachments,
      cancelAttachmentDownload,
      conversationId,
      direction,
      expirationLength,
      expirationTimestamp,
      i18n,
      id,
      isSticker,
      kickOffAttachmentDownload,
      markAttachmentAsCorrupted,
      pushPanelForConversation,
      quote,
      readStatus,
      renderAudioAttachment,
      renderingContext,
      retryMessageSend,
      shouldHideMetadata,
      shouldCollapseAbove,
      shouldCollapseBelow,
      showEditHistoryModal,
      showLightbox,
      showMediaNoLongerAvailableToast,
      status,
      text,
      textAttachment,
      theme,
      timestamp,
    } = this.props;
    const { imageBroken } = this.state;

    const collapseMetadata =
      this.#getMetadataPlacement() === MetadataPlacement.NotRendered;

    if (!attachments || !attachments[0]) {
      return null;
    }
    const firstAttachment = attachments[0];

    // For attachments which aren't full-frame
    const withContentBelow = Boolean(text || attachmentDroppedDueToSize);
    const withContentAbove = Boolean(quote) || this.#shouldRenderAuthor();
    const displayImage =
      canDisplayImage(attachments) && !attachmentDroppedDueToSize;

    // attachmentDroppedDueToSize is handled in renderAttachmentTooBig
    const isAttachmentNotAvailable =
      firstAttachment.isPermanentlyUndownloadable &&
      !attachmentDroppedDueToSize;

    if (
      displayImage &&
      !imageBroken &&
      !(isSticker && isAttachmentNotAvailable)
    ) {
      const prefix = isSticker ? 'sticker' : 'attachment';
      const containerClassName = classNames(
        `module-message__${prefix}-container`,
        withContentAbove
          ? `module-message__${prefix}-container--with-content-above`
          : null,
        withContentBelow
          ? 'module-message__attachment-container--with-content-below'
          : null,
        isSticker && !collapseMetadata
          ? 'module-message__sticker-container--with-content-below'
          : null
      );

      if (isGIF(attachments)) {
        return (
          <div className={containerClassName}>
            <GIF
              attachment={firstAttachment}
              size={GIF_SIZE}
              tabIndex={0}
              _forceTapToPlay={_forceTapToPlay}
              theme={theme}
              i18n={i18n}
              onError={this.handleImageError}
              showVisualAttachment={() => {
                showLightbox({
                  attachment: firstAttachment,
                  messageId: id,
                });
              }}
              startDownload={() => {
                kickOffAttachmentDownload({
                  messageId: id,
                });
              }}
              cancelDownload={() => {
                cancelAttachmentDownload({
                  messageId: id,
                });
              }}
              showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            />
          </div>
        );
      }

      if (isSticker || isImage(attachments) || isVideo(attachments)) {
        const bottomOverlay = !isSticker && !collapseMetadata;
        // We only want users to tab into this if there's more than one
        const tabIndex = attachments.length > 1 ? 0 : -1;

        return (
          <div className={containerClassName}>
            <ImageGrid
              attachments={attachments}
              direction={direction}
              withContentAbove={isSticker || withContentAbove}
              withContentBelow={isSticker || withContentBelow}
              isSticker={isSticker}
              stickerSize={STICKER_SIZE}
              bottomOverlay={bottomOverlay}
              i18n={i18n}
              onError={this.handleImageError}
              theme={theme}
              shouldCollapseAbove={shouldCollapseAbove}
              shouldCollapseBelow={shouldCollapseBelow}
              tabIndex={tabIndex}
              showVisualAttachment={attachment => {
                showLightbox({ attachment, messageId: id });
              }}
              startDownload={() => {
                kickOffAttachmentDownload({ messageId: id });
              }}
              cancelDownload={() => {
                cancelAttachmentDownload({ messageId: id });
              }}
              showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
            />
          </div>
        );
      }
    }

    const isAttachmentAudio = isAudio(attachments);

    if (isAttachmentNotAvailable && (isAttachmentAudio || isSticker)) {
      return this.renderSimpleAttachmentNotAvailable();
    }

    if (isAttachmentAudio) {
      const played = isPlayed(direction, status, readStatus);

      return renderAudioAttachment({
        i18n,
        buttonRef: this.audioButtonRef,
        renderingContext,
        theme,
        attachment: firstAttachment,
        collapseMetadata,
        withContentAbove,
        withContentBelow,

        direction,
        expirationLength,
        expirationTimestamp,
        id,
        conversationId,
        played,
        pushPanelForConversation,
        status,
        textPending: textAttachment?.pending,
        timestamp,

        cancelAttachmentDownload() {
          cancelAttachmentDownload({ messageId: id });
        },
        kickOffAttachmentDownload() {
          kickOffAttachmentDownload({ messageId: id });
        },
        onCorrupted() {
          markAttachmentAsCorrupted({
            attachment: firstAttachment,
            messageId: id,
          });
        },
      });
    }
    const { fileName, size, contentType } = firstAttachment;
    const isIncoming = direction === 'incoming';

    const willShowMetadata =
      expirationLength || expirationTimestamp || !shouldHideMetadata;

    // Note: this has to be interactive for the case where text comes along with the
    // attachment. But we don't want the user to tab here unless that text exists.
    const tabIndex = text ? 0 : -1;
    return (
      <button
        className={classNames(
          'module-message__simple-attachment',
          withContentBelow
            ? 'module-message__simple-attachment--with-content-below'
            : null,
          withContentAbove
            ? 'module-message__simple-attachment--with-content-above'
            : null
        )}
        type="button"
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();

          this.openGenericAttachment();
        }}
        onKeyDown={(event: React.KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }

          event.stopPropagation();
          event.preventDefault();

          this.openGenericAttachment();
        }}
        tabIndex={tabIndex}
        aria-label={
          isDownloading(firstAttachment)
            ? i18n('icu:cancelDownload')
            : i18n('icu:startDownload')
        }
      >
        <AttachmentStatusIcon
          key={id}
          attachment={firstAttachment}
          isIncoming={isIncoming}
        >
          <FileThumbnail contentType={contentType} fileName={fileName} />
        </AttachmentStatusIcon>
        <div className="module-message__simple-attachment__text">
          <div
            className={classNames(
              'module-message__simple-attachment__file-name',
              `module-message__simple-attachment__file-name--${direction}`,
              isAttachmentNotAvailable
                ? 'module-message__simple-attachment__file-name--undownloadable'
                : null
            )}
          >
            {fileName}
          </div>
          <div className="module-message__simple-attachment__bottom-row">
            {isAttachmentNotAvailable ? (
              <div className="module-message__undownloadable-attachment-file">
                <div className="module-message__undownloadable-attachment__icon-container--file">
                  <div className="module-message__undownloadable-attachment__icon module-message__undownloadable-attachment__icon--file module-message__undownloadable-attachment__icon--small" />
                </div>
                <div className="module-message__undownloadable-attachment-info--file">
                  {i18n('icu:attachmentNotAvailable__file')}
                </div>
              </div>
            ) : (
              <div
                className={classNames(
                  'module-message__simple-attachment__file-size',
                  `module-message__simple-attachment__file-size--${direction}`
                )}
              >
                {formatFileSize(size)}
              </div>
            )}
            {text || !willShowMetadata ? undefined : (
              <div className="module-message__simple-attachment__metadata-container">
                <MessageMetadata
                  deletedForEveryone={false}
                  direction={direction}
                  expirationLength={expirationLength}
                  expirationTimestamp={expirationTimestamp}
                  hasText={false}
                  i18n={i18n}
                  id={id}
                  isEditedMessage={false}
                  isSMS={false}
                  isInline={false}
                  isOutlineOnlyBubble={false}
                  isShowingImage={false}
                  isSticker={false}
                  onWidthMeasured={undefined}
                  pushPanelForConversation={pushPanelForConversation}
                  ref={this.#metadataRef}
                  retryMessageSend={retryMessageSend}
                  showEditHistoryModal={showEditHistoryModal}
                  status={status}
                  textPending={false}
                  timestamp={timestamp}
                />
              </div>
            )}
          </div>
        </div>
      </button>
    );
  }

  public renderSimpleAttachmentNotAvailable(): JSX.Element | null {
    const {
      attachmentDroppedDueToSize,
      attachments,
      author,
      i18n,
      isSticker,
      isTapToView,
      isTapToViewError,
      isTapToViewExpired,
      readStatus,
      showTapToViewNotAvailableModal,
      text,
      quote,
    } = this.props;

    const isAttachmentAudio = isAudio(attachments);
    const withContentBelow = Boolean(text || attachmentDroppedDueToSize);
    const withContentAbove = Boolean(quote) || this.#shouldRenderAuthor();
    const isViewed = readStatus === ReadStatus.Viewed;

    let attachmentType: string;
    let info: string;
    let tapToViewModalType: TapToViewNotAvailableType | undefined;
    if (isAttachmentAudio) {
      attachmentType = 'audio';
      info = i18n('icu:attachmentNotAvailable__voice');
    } else if (isSticker) {
      attachmentType = 'sticker';
      info = i18n('icu:attachmentNotAvailable__sticker');
    } else if (isTapToView && !isViewed && isTapToViewExpired) {
      attachmentType = 'tap-to-view';
      info = i18n('icu:attachmentNotAvailable__tapToView');
      tapToViewModalType = TapToViewNotAvailableType.Expired;
    } else if (isTapToView && !isViewed && isTapToViewError) {
      attachmentType = 'tap-to-view';
      info = i18n('icu:attachmentNotAvailable__tapToViewCannotDownload');
      tapToViewModalType = TapToViewNotAvailableType.Error;
    } else {
      assertDev(
        false,
        'renderAttachment(): Invalid case for permanently undownloadable attachment'
      );
      return null;
    }

    const containerClassName = classNames(
      'module-message__undownloadable-attachment',
      withContentAbove
        ? 'module-message__undownloadable-attachment--with-content-above'
        : null,
      withContentBelow
        ? 'module-message__undownloadable-attachment--with-content-below'
        : null,
      text ? null : 'module-message__undownloadable-attachment--no-text'
    );
    const iconClassName = classNames(
      'module-message__undownloadable-attachment__icon',
      `module-message__undownloadable-attachment__icon--${attachmentType}`
    );

    return (
      <div className={containerClassName}>
        <div className="module-message__undownloadable-attachment__icon-container">
          <div className={iconClassName} />
        </div>
        <div>
          <div className="module-message__undownloadable-attachment-info">
            {info}
          </div>
          {tapToViewModalType ? (
            <div className="module-message__undownloadable-attachment-learn-more-container">
              <button
                className="module-message__undownloadable-attachment-learn-more"
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  showTapToViewNotAvailableModal({
                    type: tapToViewModalType,
                    parameters: {
                      name: author.firstName || author.title,
                    },
                  });
                }}
                type="button"
              >
                {i18n('icu:attachmentNoLongerAvailable__learnMore')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  public renderUndownloadableTextAttachment(): JSX.Element | null {
    const { i18n, textAttachment } = this.props;
    if (!textAttachment || !textAttachment.isPermanentlyUndownloadable) {
      return null;
    }
    return (
      <div className="module-message__simple-attachment module-message__undownloadable-attachment-text">
        <div className="module-message__undownloadable-attachment-text__icon-container">
          <div className="module-message__undownloadable-attachment__icon module-message__undownloadable-attachment__icon--file" />
        </div>
        <div>
          <div className="module-message__undownloadable-attachment-info">
            {i18n('icu:attachmentNotAvailable__longMessage')}
          </div>
        </div>
      </div>
    );
  }

  public renderPreview(): JSX.Element | null {
    const {
      attachments,
      conversationType,
      direction,
      i18n,
      id,
      kickOffAttachmentDownload,
      cancelAttachmentDownload,
      showMediaNoLongerAvailableToast,
      previews,
      quote,
      shouldCollapseAbove,
      theme,
    } = this.props;

    // Attachments take precedence over Link Previews
    if (attachments && attachments.length) {
      return null;
    }

    if (!previews || previews.length < 1) {
      return null;
    }

    const first = previews[0];
    if (!first) {
      return null;
    }

    const withContentAbove =
      Boolean(quote) ||
      (!shouldCollapseAbove &&
        conversationType === 'group' &&
        direction === 'incoming');

    const previewHasImage = isImageAttachment(first.image);
    const isFullSizeImage = shouldUseFullSizeLinkPreviewImage(first);

    const linkPreviewDate = first.date || null;
    const title =
      first.title ||
      (first.isCallLink
        ? i18n('icu:calling__call-link-default-title')
        : undefined);
    const description =
      first.description ||
      (first.isCallLink
        ? i18n('icu:message--call-link-description')
        : undefined);

    const isClickable = this.#areLinksEnabled();

    const className = classNames(
      'module-message__link-preview',
      `module-message__link-preview--${direction}`,
      {
        'module-message__link-preview--with-content-above': withContentAbove,
        'module-message__link-preview--nonclickable': !isClickable,
      }
    );
    const contents = (
      <>
        {first.image && previewHasImage && isFullSizeImage ? (
          <ImageGrid
            attachments={[first.image]}
            withContentAbove={withContentAbove}
            direction={direction}
            shouldCollapseAbove={shouldCollapseAbove}
            withContentBelow
            onError={this.handleImageError}
            i18n={i18n}
            theme={theme}
            showVisualAttachment={() => {
              openLinkInWebBrowser(first.url);
            }}
            startDownload={() => {
              kickOffAttachmentDownload({ messageId: id });
            }}
            cancelDownload={() => {
              cancelAttachmentDownload({ messageId: id });
            }}
            showMediaNoLongerAvailableToast={showMediaNoLongerAvailableToast}
          />
        ) : null}
        <div dir="auto" className="module-message__link-preview__content">
          {first.image &&
          first.domain &&
          previewHasImage &&
          !isFullSizeImage ? (
            <div className="module-message__link-preview__icon_container">
              <Image
                noBorder
                noBackground
                curveBottomLeft={
                  withContentAbove ? CurveType.Tiny : CurveType.Small
                }
                curveBottomRight={CurveType.Tiny}
                curveTopRight={CurveType.Tiny}
                curveTopLeft={CurveType.Tiny}
                alt={i18n('icu:previewThumbnail', {
                  domain: first.domain,
                })}
                height={72}
                width={72}
                url={first.image.url}
                attachment={first.image}
                blurHash={first.image.blurHash}
                onError={this.handleImageError}
                i18n={i18n}
                showMediaNoLongerAvailableToast={
                  showMediaNoLongerAvailableToast
                }
                showVisualAttachment={() => {
                  openLinkInWebBrowser(first.url);
                }}
                startDownload={() => {
                  kickOffAttachmentDownload({ messageId: id });
                }}
                cancelDownload={() => {
                  cancelAttachmentDownload({ messageId: id });
                }}
              />
            </div>
          ) : null}
          {first.isCallLink && (
            <div className="module-message__link-preview__call-link-icon">
              <Avatar
                badge={undefined}
                color={getColorForCallLink(getKeyFromCallLink(first.url))}
                conversationType="callLink"
                i18n={i18n}
                sharedGroupNames={[]}
                size={64}
                title={title ?? i18n('icu:calling__call-link-default-title')}
              />
            </div>
          )}
          <div
            className={classNames(
              'module-message__link-preview__text',
              previewHasImage && !isFullSizeImage
                ? 'module-message__link-preview__text--with-icon'
                : null
            )}
          >
            <div className="module-message__link-preview__title">{title}</div>
            {description && (
              <div className="module-message__link-preview__description">
                {unescape(description)}
              </div>
            )}
            <div className="module-message__link-preview__footer">
              <div className="module-message__link-preview__location">
                {first.domain}
              </div>
              <LinkPreviewDate
                date={linkPreviewDate}
                className="module-message__link-preview__date"
              />
            </div>
          </div>
        </div>
      </>
    );

    return isClickable ? (
      <div
        role="link"
        tabIndex={0}
        className={className}
        onKeyDown={(event: React.KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === 'Space') {
            event.stopPropagation();
            event.preventDefault();

            openLinkInWebBrowser(first.url);
          }
        }}
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();

          openLinkInWebBrowser(first.url);
        }}
      >
        {contents}
      </div>
    ) : (
      <div className={className}>{contents}</div>
    );
  }

  public renderAttachmentTooBig(): JSX.Element | null {
    const {
      attachments,
      attachmentDroppedDueToSize,
      direction,
      i18n,
      quote,
      shouldCollapseAbove,
      shouldCollapseBelow,
      text,
    } = this.props;
    const { metadataWidth } = this.state;

    if (!attachmentDroppedDueToSize) {
      return null;
    }

    const labelText = attachments?.length
      ? i18n('icu:message--attachmentTooBig--multiple')
      : i18n('icu:message--attachmentTooBig--one');

    const isContentAbove = quote || attachments?.length;
    const isContentBelow = Boolean(text);
    const willCollapseAbove = shouldCollapseAbove && !isContentAbove;
    const willCollapseBelow = shouldCollapseBelow && !isContentBelow;

    const maybeSpacer = text
      ? undefined
      : this.#getMetadataPlacement() === MetadataPlacement.InlineWithText && (
          <MessageTextMetadataSpacer metadataWidth={metadataWidth} />
        );

    return (
      <div
        className={classNames(
          'module-message__attachment-too-big',
          isContentAbove
            ? 'module-message__attachment-too-big--content-above'
            : null,
          isContentBelow
            ? 'module-message__attachment-too-big--content-below'
            : null,
          willCollapseAbove
            ? `module-message__attachment-too-big--collapse-above--${direction}`
            : null,
          willCollapseBelow
            ? `module-message__attachment-too-big--collapse-below--${direction}`
            : null
        )}
      >
        {labelText}
        {maybeSpacer}
      </div>
    );
  }

  public renderGiftBadge(): JSX.Element | null {
    const { conversationTitle, direction, getPreferredBadge, giftBadge, i18n } =
      this.props;
    const { showOutgoingGiftBadgeModal } = this.state;
    if (!giftBadge) {
      return null;
    }

    if (
      giftBadge.state === GiftBadgeStates.Unopened ||
      giftBadge.state === GiftBadgeStates.Failed
    ) {
      const description =
        direction === 'incoming'
          ? i18n('icu:message--donation--unopened--incoming')
          : i18n('icu:message--donation--unopened--outgoing');
      const { metadataWidth } = this.state;

      return (
        <div className="module-message__unopened-gift-badge__container">
          <div
            className={classNames(
              'module-message__unopened-gift-badge',
              `module-message__unopened-gift-badge--${direction}`
            )}
            aria-label={i18n('icu:message--donation--unopened--label', {
              sender: conversationTitle,
            })}
          >
            <div
              className="module-message__unopened-gift-badge__ribbon-horizontal"
              aria-hidden
            />
            <div
              className="module-message__unopened-gift-badge__ribbon-vertical"
              aria-hidden
            />
            <img
              className="module-message__unopened-gift-badge__bow"
              src="images/gift-bow.svg"
              alt=""
              aria-hidden
            />
          </div>
          <div
            className={classNames(
              'module-message__unopened-gift-badge__text',
              `module-message__unopened-gift-badge__text--${direction}`
            )}
          >
            <div
              className={classNames(
                'module-message__text',
                `module-message__text--${direction}`
              )}
            >
              {description}
              {this.#getMetadataPlacement() ===
                MetadataPlacement.InlineWithText && (
                <MessageTextMetadataSpacer metadataWidth={metadataWidth} />
              )}
            </div>
            {this.#renderMetadata()}
          </div>
        </div>
      );
    }

    if (
      giftBadge.state === GiftBadgeStates.Redeemed ||
      giftBadge.state === GiftBadgeStates.Opened
    ) {
      const badgeId = giftBadge.id || `BOOST-${giftBadge.level}`;
      const badgeSize = 64;
      const badge = getPreferredBadge([{ id: badgeId }]);
      const badgeImagePath = getBadgeImageFileLocalPath(
        badge,
        badgeSize,
        BadgeImageTheme.Transparent
      );

      let remaining: string;
      const duration = giftBadge.expiration - Date.now();

      const remainingDays = Math.floor(duration / DAY);
      const remainingHours = Math.floor(duration / HOUR);
      const remainingMinutes = Math.floor(duration / MINUTE);

      if (remainingDays > 1) {
        remaining = i18n('icu:message--donation--remaining--days', {
          days: remainingDays,
        });
      } else if (remainingHours > 1) {
        remaining = i18n('icu:message--donation--remaining--hours', {
          hours: remainingHours,
        });
      } else if (remainingMinutes > 0) {
        remaining = i18n('icu:message--donation--remaining--minutes', {
          minutes: remainingMinutes,
        });
      } else {
        remaining = i18n('icu:message--donation--expired');
      }

      const wasSent = direction === 'outgoing';
      const buttonContents = wasSent ? (
        i18n('icu:message--donation--view')
      ) : (
        <>
          <span
            className={classNames(
              'module-message__redeemed-gift-badge__icon-check',
              `module-message__redeemed-gift-badge__icon-check--${direction}`
            )}
          />{' '}
          {i18n('icu:message--donation--redeemed')}
        </>
      );

      const badgeElement = badge ? (
        <img
          className="module-message__redeemed-gift-badge__badge"
          src={badgeImagePath}
          alt={badge.name}
        />
      ) : (
        <div
          className={classNames(
            'module-message__redeemed-gift-badge__badge',
            `module-message__redeemed-gift-badge__badge--missing-${direction}`
          )}
          aria-label={i18n('icu:donation--missing')}
        />
      );

      return (
        <div className="module-message__redeemed-gift-badge__container">
          <div className="module-message__redeemed-gift-badge">
            {badgeElement}
            <div className="module-message__redeemed-gift-badge__text">
              <div className="module-message__redeemed-gift-badge__title">
                {i18n('icu:message--donation')}
              </div>
              <div
                className={classNames(
                  'module-message__redeemed-gift-badge__remaining',
                  `module-message__redeemed-gift-badge__remaining--${direction}`
                )}
              >
                {remaining}
              </div>
            </div>
          </div>
          <button
            className={classNames(
              'module-message__redeemed-gift-badge__button',
              `module-message__redeemed-gift-badge__button--${direction}`
            )}
            disabled={!wasSent}
            onClick={
              wasSent
                ? () => this.setState({ showOutgoingGiftBadgeModal: true })
                : undefined
            }
            type="button"
          >
            <div className="module-message__redeemed-gift-badge__button__text">
              {buttonContents}
            </div>
          </button>
          {this.#renderMetadata()}
          {showOutgoingGiftBadgeModal ? (
            <OutgoingGiftBadgeModal
              i18n={i18n}
              recipientTitle={conversationTitle}
              badgeId={badgeId}
              getPreferredBadge={getPreferredBadge}
              hideOutgoingGiftBadgeModal={() =>
                this.setState({ showOutgoingGiftBadgeModal: false })
              }
            />
          ) : null}
        </div>
      );
    }

    throw missingCaseError(giftBadge.state);
  }

  public renderPayment(): JSX.Element | null {
    const {
      payment,
      direction,
      author,
      conversationTitle,
      conversationColor,
      i18n,
    } = this.props;
    if (payment == null || !isPaymentNotificationEvent(payment)) {
      return null;
    }

    return (
      <div
        className={`module-payment-notification__container ${
          direction === 'outgoing'
            ? `module-payment-notification--outgoing module-payment-notification--outgoing-${conversationColor}`
            : ''
        }`}
      >
        <p className="module-payment-notification__label">
          {getPaymentEventDescription(
            payment,
            author.title,
            conversationTitle,
            author.isMe,
            i18n
          )}
        </p>
        <p className="module-payment-notification__check_device_box">
          {i18n('icu:payment-event-notification-check-primary-device')}
        </p>
        {payment.note != null && (
          <p className="module-payment-notification__note">
            <UserText text={payment.note} />
          </p>
        )}
      </div>
    );
  }

  public renderPoll(): JSX.Element | null {
    const { poll, direction, i18n, id } = this.props;
    if (!poll || !isPollReceiveEnabled()) {
      return null;
    }
    return (
      <PollMessageContents
        poll={poll}
        direction={direction}
        i18n={i18n}
        messageId={id}
        sendPollVote={this.props.sendPollVote}
      />
    );
  }

  #doubleCheckMissingQuoteReference = () => {
    return this.props.doubleCheckMissingQuoteReference(this.props.id);
  };

  public renderQuote(): JSX.Element | null {
    const {
      conversationColor,
      conversationId,
      conversationTitle,
      customColor,
      direction,
      disableScroll,
      i18n,
      quote,
      scrollToQuotedMessage,
    } = this.props;

    if (!quote) {
      return null;
    }

    const { isGiftBadge, isViewOnce, referencedMessageNotFound } = quote;

    const clickHandler = disableScroll
      ? undefined
      : () => {
          scrollToQuotedMessage({
            authorId: quote.authorId,
            conversationId,
            sentAt: quote.sentAt,
          });
        };

    const isIncoming = direction === 'incoming';

    return (
      <Quote
        i18n={i18n}
        onClick={clickHandler}
        text={quote.text}
        rawAttachment={quote.rawAttachment}
        payment={quote.payment}
        isIncoming={isIncoming}
        authorTitle={quote.authorTitle}
        bodyRanges={quote.bodyRanges}
        conversationColor={conversationColor}
        conversationTitle={conversationTitle}
        customColor={customColor}
        isViewOnce={isViewOnce}
        isGiftBadge={isGiftBadge}
        referencedMessageNotFound={referencedMessageNotFound}
        isFromMe={quote.isFromMe}
        doubleCheckMissingQuoteReference={
          this.#doubleCheckMissingQuoteReference
        }
      />
    );
  }

  public renderStoryReplyContext(): JSX.Element | null {
    const {
      conversationTitle,
      conversationColor,
      customColor,
      direction,
      i18n,
      storyReplyContext,
      viewStory,
    } = this.props;

    if (!storyReplyContext) {
      return null;
    }

    const isIncoming = direction === 'incoming';

    return (
      <>
        {storyReplyContext.emoji && (
          <div className="module-message__quote-story-reaction-header">
            {isIncoming
              ? i18n('icu:Quote__story-reaction--you')
              : i18n('icu:Quote__story-reaction', {
                  name: storyReplyContext.authorTitle,
                })}
          </div>
        )}
        <Quote
          authorTitle={storyReplyContext.authorTitle}
          conversationColor={conversationColor}
          conversationTitle={conversationTitle}
          customColor={customColor}
          i18n={i18n}
          isFromMe={storyReplyContext.isFromMe}
          isGiftBadge={false}
          isIncoming={isIncoming}
          isStoryReply
          isViewOnce={false}
          moduleClassName="StoryReplyQuote"
          onClick={() => {
            if (!storyReplyContext.storyId) {
              return;
            }
            viewStory({
              storyId: storyReplyContext.storyId,
              storyViewMode: StoryViewModeType.Single,
            });
          }}
          rawAttachment={storyReplyContext.rawAttachment}
          reactionEmoji={storyReplyContext.emoji}
          referencedMessageNotFound={!storyReplyContext.storyId}
          text={storyReplyContext.text}
        />
      </>
    );
  }

  public renderEmbeddedContact(): JSX.Element | null {
    const {
      cancelAttachmentDownload,
      contact,
      conversationType,
      direction,
      i18n,
      id,
      kickOffAttachmentDownload,
      pushPanelForConversation,
      text,
    } = this.props;
    if (!contact) {
      return null;
    }

    const withCaption = Boolean(text);
    const withContentAbove =
      conversationType === 'group' && direction === 'incoming';
    const withContentBelow =
      withCaption ||
      this.#getMetadataPlacement() !== MetadataPlacement.NotRendered;

    const otherContent =
      (contact && contact.firstNumber && contact.serviceId) || withCaption;

    const attachment = contact.avatar?.avatar;
    const avatarNeedsAction =
      attachment &&
      !isDownloaded(attachment) &&
      !attachment.isPermanentlyUndownloadable;
    const tabIndex = otherContent || avatarNeedsAction ? 0 : -1;

    return (
      <EmbeddedContact
        contact={contact}
        isIncoming={direction === 'incoming'}
        i18n={i18n}
        onClick={() => {
          if (avatarNeedsAction) {
            if (isDownloading(attachment)) {
              cancelAttachmentDownload({ messageId: id });
            } else {
              kickOffAttachmentDownload({ messageId: id });
            }

            return;
          }

          pushPanelForConversation({
            type: PanelType.ContactDetails,
            args: {
              messageId: id,
            },
          });
        }}
        withContentAbove={withContentAbove}
        withContentBelow={withContentBelow}
        tabIndex={tabIndex}
      />
    );
  }

  public renderSendMessageButton(): JSX.Element | null {
    const { contact, direction, shouldCollapseBelow, startConversation, i18n } =
      this.props;
    const noBottomLeftCurve = direction === 'incoming' && shouldCollapseBelow;
    const noBottomRightCurve = direction === 'outgoing' && shouldCollapseBelow;

    if (!contact) {
      return null;
    }
    const { firstNumber, serviceId } = contact;
    if (!firstNumber || !serviceId) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          startConversation(firstNumber, serviceId);
        }}
        className={classNames(
          'module-message__send-message-button',
          noBottomLeftCurve &&
            'module-message__send-message-button--no-bottom-left-curve',
          noBottomRightCurve &&
            'module-message__send-message-button--no-bottom-right-curve'
        )}
      >
        {i18n('icu:sendMessageToContact')}
      </button>
    );
  }

  #renderAvatar(): ReactNode {
    const {
      author,
      conversationId,
      conversationType,
      direction,
      getPreferredBadge,
      i18n,
      shouldCollapseBelow,
      showContactModal,
      theme,
    } = this.props;

    if (conversationType !== 'group' || direction !== 'incoming') {
      return null;
    }

    return (
      <div
        className={classNames('module-message__author-avatar-container', {
          'module-message__author-avatar-container--with-reactions':
            this.#hasReactions(),
        })}
      >
        {shouldCollapseBelow ? (
          <AvatarSpacer size={GROUP_AVATAR_SIZE} />
        ) : (
          <Avatar
            avatarUrl={author.avatarUrl}
            badge={getPreferredBadge(author.badges)}
            color={author.color}
            conversationType="direct"
            i18n={i18n}
            onClick={event => {
              event.stopPropagation();
              event.preventDefault();

              showContactModal(author.id, conversationId);
            }}
            phoneNumber={author.phoneNumber}
            profileName={author.profileName}
            sharedGroupNames={author.sharedGroupNames}
            size={GROUP_AVATAR_SIZE}
            theme={theme}
            title={author.title}
          />
        )}
      </div>
    );
  }

  #getContents(): string | undefined {
    const { deletedForEveryone, direction, i18n, status, text } = this.props;

    if (deletedForEveryone) {
      return i18n('icu:message--deletedForEveryone');
    }
    if (direction === 'incoming' && status === 'error') {
      return i18n('icu:incomingError');
    }

    return text;
  }

  public renderText(): JSX.Element | null {
    const {
      bodyRanges,
      deletedForEveryone,
      direction,
      displayLimit,
      i18n,
      id,
      isSpoilerExpanded,
      kickOffAttachmentDownload,
      messageExpanded,
      payment,
      showConversation,
      showSpoiler,
      status,

      textAttachment,
    } = this.props;
    const { metadataWidth } = this.state;

    const contents = this.#getContents();

    if (!contents) {
      return null;
    }

    // Payment notifications are rendered in renderPayment, but they may have additional
    // text in message.body for backwards-compatibility that we don't want to render
    if (payment && isPaymentNotificationEvent(payment)) {
      return null;
    }

    return (
      <div // eslint-disable-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions
        className={classNames(
          'module-message__text',
          `module-message__text--${direction}`,
          status === 'error' && direction === 'incoming'
            ? 'module-message__text--error'
            : null,
          deletedForEveryone
            ? 'module-message__text--delete-for-everyone'
            : null
        )}
        onClick={e => {
          // Prevent metadata from being selected on triple clicks.
          const clickCount = e.detail;
          const range = window.getSelection()?.getRangeAt(0);
          if (
            clickCount === 3 &&
            this.#metadataRef.current &&
            range?.intersectsNode(this.#metadataRef.current)
          ) {
            range.setEndBefore(this.#metadataRef.current);
          }
        }}
        onDoubleClick={(event: React.MouseEvent) => {
          // Prevent double-click interefering with interactions _inside_
          // the bubble.
          event.stopPropagation();
        }}
      >
        <MessageBodyReadMore
          bodyRanges={bodyRanges}
          direction={direction}
          disableLinks={!this.#areLinksEnabled()}
          displayLimit={displayLimit}
          i18n={i18n}
          id={id}
          isSpoilerExpanded={isSpoilerExpanded || {}}
          kickOffBodyDownload={() => {
            if (!textAttachment) {
              return;
            }
            if (isDownloaded(textAttachment)) {
              return;
            }
            kickOffAttachmentDownload({
              messageId: id,
            });
          }}
          messageExpanded={messageExpanded}
          showConversation={showConversation}
          renderLocation={RenderLocation.Timeline}
          onExpandSpoiler={data => showSpoiler(id, data)}
          text={contents || ''}
          textAttachment={textAttachment}
        />
        {this.#getMetadataPlacement() === MetadataPlacement.InlineWithText && (
          <MessageTextMetadataSpacer metadataWidth={metadataWidth} />
        )}
      </div>
    );
  }

  #shouldShowJoinButton(): boolean {
    const { previews } = this.props;

    if (previews?.length !== 1) {
      return false;
    }

    const onlyPreview = previews[0];
    return Boolean(onlyPreview.isCallLink);
  }

  #renderAction(): JSX.Element | null {
    const { direction, activeCallConversationId, i18n, previews } = this.props;

    if (this.#shouldShowJoinButton()) {
      const firstPreview = previews[0];
      const inAnotherCall = Boolean(
        activeCallConversationId &&
          (!firstPreview.callLinkRoomId ||
            activeCallConversationId !== firstPreview.callLinkRoomId)
      );

      const joinButton = (
        <button
          type="button"
          className={classNames('module-message__action', {
            'module-message__action--incoming': direction === 'incoming',
            'module-message__action--outgoing': direction === 'outgoing',
            'module-message__action--incoming--in-another-call':
              direction === 'incoming' && inAnotherCall,
            'module-message__action--outgoing--in-another-call':
              direction === 'outgoing' && inAnotherCall,
          })}
          onClick={() => openLinkInWebBrowser(firstPreview?.url)}
        >
          {i18n('icu:calling__join')}
        </button>
      );

      return inAnotherCall ? (
        <InAnotherCallTooltip i18n={i18n}>{joinButton}</InAnotherCallTooltip>
      ) : (
        joinButton
      );
    }

    return null;
  }

  #renderError(): ReactNode {
    const { status, direction } = this.props;

    if (
      status !== 'paused' &&
      status !== 'error' &&
      status !== 'partial-sent'
    ) {
      return null;
    }

    return (
      <div className="module-message__error-container">
        <div
          className={classNames(
            'module-message__error',
            `module-message__error--${direction}`,
            `module-message__error--${status}`
          )}
        />
      </div>
    );
  }

  public getWidth(): number | undefined {
    const { attachments, giftBadge, isSticker, isTapToView, previews } =
      this.props;

    if (isTapToView) {
      return undefined;
    }

    if (giftBadge) {
      return 240;
    }

    if (attachments && attachments.length) {
      if (isGIF(attachments)) {
        // Message container border
        return GIF_SIZE + 2;
      }

      if (isSticker) {
        // Padding is 8px, on both sides
        return STICKER_SIZE + 8 * 2;
      }

      const dimensions = getGridDimensions(attachments);
      if (dimensions) {
        return dimensions.width;
      }
    }

    const firstLinkPreview = (previews || [])[0];
    if (
      firstLinkPreview &&
      firstLinkPreview.image &&
      shouldUseFullSizeLinkPreviewImage(firstLinkPreview)
    ) {
      const dimensions = getImageDimensionsForTimeline(firstLinkPreview.image);
      if (dimensions) {
        return dimensions.width;
      }
    }

    if (firstLinkPreview && firstLinkPreview.isCallLink) {
      return 300;
    }

    return undefined;
  }

  public isShowingImage(): boolean {
    const { isTapToView, attachments, previews } = this.props;
    const { imageBroken } = this.state;

    if (imageBroken || isTapToView) {
      return false;
    }

    if (attachments && attachments.length) {
      const displayImage = canDisplayImage(attachments);

      return displayImage && (isImage(attachments) || isVideo(attachments));
    }

    if (previews && previews.length) {
      const first = previews[0];
      const { image } = first;

      return isImageAttachment(image);
    }

    return false;
  }

  public isAttachmentPending(): boolean {
    const { attachments } = this.props;

    if (!attachments || attachments.length < 1) {
      return false;
    }

    const first = attachments[0];

    return Boolean(first.pending);
  }

  public renderTapToViewIcon(): JSX.Element {
    const { direction, isTapToViewError, isTapToViewExpired, readStatus } =
      this.props;
    const isIncoming = direction === 'incoming';

    let state = 'ready';
    let isDisabled = false;
    if (!isIncoming) {
      state = 'outgoing';
      isDisabled = true;
    } else if (readStatus === ReadStatus.Viewed) {
      state = 'viewed';
      isDisabled = true;
    } else if (isTapToViewError || isTapToViewExpired) {
      throw new Error(
        'renderTapToViewIcon: This state is handled in renderSimpleAttachmentNotAvailable'
      );
    }

    return (
      <div
        className={classNames(
          'AttachmentStatusIcon__circle-icon-container',
          isIncoming
            ? 'AttachmentStatusIcon__circle-icon-container--incoming'
            : null,
          isDisabled
            ? 'AttachmentStatusIcon__circle-icon-container--disabled'
            : null
        )}
      >
        <div
          className={classNames(
            'AttachmentStatusIcon__circle-icon',
            isIncoming ? 'AttachmentStatusIcon__circle-icon--incoming' : null,
            state === 'ready'
              ? 'module-message__tap-to-view__icon--ready'
              : null,
            state === 'outgoing'
              ? 'module-message__tap-to-view__icon--outgoing'
              : null,
            state === 'viewed'
              ? 'module-message__tap-to-view__icon--viewed'
              : null
          )}
        />
      </div>
    );
  }

  public renderTapToViewText(): { title: string; detail: string | undefined } {
    const {
      attachments,
      direction,
      i18n,
      isTapToViewExpired,
      isTapToViewError,
      readStatus,
    } = this.props;

    if (direction === 'outgoing') {
      return {
        title: i18n('icu:Message--tap-to-view--media'),
        detail: undefined,
      };
    }
    if (readStatus === ReadStatus.Viewed) {
      return {
        title: i18n('icu:Message--tap-to-view--viewed'),
        detail: undefined,
      };
    }
    if (isTapToViewExpired || isTapToViewError) {
      throw new Error(
        'renderTapToViewText: This state is handled in renderSimpleAttachmentNotAvailable'
      );
    }

    let detail = i18n('icu:Message--tap-to-view--helper-text');
    const firstAttachment = attachments?.[0];
    if (firstAttachment && !firstAttachment.path) {
      detail = formatFileSize(firstAttachment.size);
    }

    if (isVideo(attachments) || isGIF(attachments)) {
      return {
        title: i18n('icu:Message--tap-to-view--video'),
        detail,
      };
    }
    return {
      title: i18n('icu:Message--tap-to-view--photo'),
      detail,
    };
  }

  public renderTapToView(): JSX.Element | null {
    const {
      attachments,
      attachmentDroppedDueToSize,
      conversationType,
      direction,
      expirationLength,
      expirationTimestamp,
      i18n,
      id,
      isTapToViewError,
      isTapToViewExpired,
      pushPanelForConversation,
      readStatus,
      retryMessageSend,
      showEditHistoryModal,
      status,
      timestamp,
    } = this.props;

    const firstAttachment = attachments?.[0];

    const isIncoming = direction === 'incoming';
    const isViewed = readStatus === ReadStatus.Viewed;
    const isExpired = Boolean(
      !isViewed &&
        (isTapToViewExpired || firstAttachment?.isPermanentlyUndownloadable)
    );
    const isError = isTapToViewError || attachmentDroppedDueToSize;

    const collapseMetadata =
      this.#getMetadataPlacement() === MetadataPlacement.NotRendered;
    const withContentAbove =
      !collapseMetadata &&
      conversationType === 'group' &&
      direction === 'incoming';

    if (isIncoming && !isViewed && (isError || isExpired)) {
      return this.renderSimpleAttachmentNotAvailable();
    }

    const text = this.renderTapToViewText();
    let content: JSX.Element;
    if (text.title && text.detail) {
      content = (
        <div className="module-message__simple-attachment__text">
          <div
            className={classNames(
              'module-message__simple-attachment__file-name',
              `module-message__simple-attachment__file-name--${direction}`
            )}
          >
            {text.title}
          </div>
          <div className="module-message__simple-attachment__bottom-row">
            <div
              className={classNames(
                'module-message__simple-attachment__file-size',
                `module-message__simple-attachment__file-size--${direction}`
              )}
            >
              {text.detail}
            </div>
            {collapseMetadata ? undefined : (
              <div className="module-message__simple-attachment__metadata-container">
                <MessageMetadata
                  deletedForEveryone={false}
                  direction={direction}
                  expirationLength={expirationLength}
                  expirationTimestamp={expirationTimestamp}
                  hasText={false}
                  i18n={i18n}
                  id={id}
                  isEditedMessage={false}
                  isSMS={false}
                  isInline={false}
                  isOutlineOnlyBubble={false}
                  isShowingImage={false}
                  isSticker={false}
                  onWidthMeasured={undefined}
                  pushPanelForConversation={pushPanelForConversation}
                  ref={this.#metadataRef}
                  retryMessageSend={retryMessageSend}
                  showEditHistoryModal={showEditHistoryModal}
                  status={status}
                  textPending={false}
                  timestamp={timestamp}
                />
              </div>
            )}
          </div>
        </div>
      );
    } else {
      content = (
        <>
          <div
            className={classNames(
              'module-message__simple-attachment__file-name',
              `module-message__simple-attachment__file-name--${direction}`
            )}
          >
            {text.title}
          </div>
          {collapseMetadata ? undefined : (
            <div className="module-message__simple-attachment__metadata-container">
              <MessageMetadata
                deletedForEveryone={false}
                direction={direction}
                expirationLength={expirationLength}
                expirationTimestamp={expirationTimestamp}
                hasText={false}
                i18n={i18n}
                id={id}
                isEditedMessage={false}
                isSMS={false}
                isInline={false}
                isOutlineOnlyBubble={false}
                isShowingImage={false}
                isSticker={false}
                onWidthMeasured={undefined}
                pushPanelForConversation={pushPanelForConversation}
                ref={this.#metadataRef}
                retryMessageSend={retryMessageSend}
                showEditHistoryModal={showEditHistoryModal}
                status={status}
                textPending={false}
                timestamp={timestamp}
              />
            </div>
          )}
        </>
      );
    }

    return (
      <div
        className={classNames(
          'module-message__simple-attachment',
          withContentAbove
            ? 'module-message__simple-attachment--with-content-above'
            : null
        )}
      >
        {isExpired || firstAttachment == null ? (
          this.renderTapToViewIcon()
        ) : (
          <AttachmentStatusIcon
            key={id}
            attachment={firstAttachment}
            isIncoming={isIncoming}
          >
            {this.renderTapToViewIcon()}
          </AttachmentStatusIcon>
        )}
        {content}
      </div>
    );
  }

  #popperPreventOverflowModifier = (): Partial<PreventOverflowModifier> => {
    const { containerElementRef } = this.props;
    return {
      name: 'preventOverflow',
      options: {
        altAxis: true,
        boundary: containerElementRef.current || undefined,
        padding: {
          bottom: 16,
          left: 8,
          right: 8,
          top: 16,
        },
      },
    };
  };

  public toggleReactionViewer = (onlyRemove = false): void => {
    this.setState(oldState => {
      const { reactionViewerRoot } = oldState;
      if (reactionViewerRoot) {
        document.body.removeChild(reactionViewerRoot);

        oldState.reactionViewerOutsideClickDestructor?.();

        return {
          reactionViewerRoot: null,
          reactionViewerOutsideClickDestructor: undefined,
        };
      }

      if (!onlyRemove) {
        const root = document.createElement('div');
        document.body.appendChild(root);

        const reactionViewerOutsideClickDestructor = handleOutsideClick(
          () => {
            this.toggleReactionViewer(true);
            return true;
          },
          {
            containerElements: [root, this.reactionsContainerRef],
            name: 'Message.reactionViewer',
          }
        );

        return {
          reactionViewerRoot: root,
          reactionViewerOutsideClickDestructor,
        };
      }

      return null;
    });
  };

  public renderReactions(outgoing: boolean): JSX.Element | null {
    const { getPreferredBadge, reactions = [], i18n, theme } = this.props;

    if (!this.#hasReactions()) {
      return null;
    }

    const { reactionViewerRoot } = this.state;

    return (
      <MessageReactions
        reactions={reactions}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        theme={theme}
        outgoing={outgoing}
        toggleReactionViewer={() => {
          this.toggleReactionViewer();
        }}
        reactionViewerRoot={reactionViewerRoot}
        popperPreventOverflowModifier={this.#popperPreventOverflowModifier}
        ref={this.reactionsContainerRef}
      />
    );
  }

  public renderContents(): JSX.Element | null {
    const { deletedForEveryone, giftBadge, isTapToView } = this.props;

    if (deletedForEveryone) {
      return (
        <>
          {this.renderText()}
          {this.#renderMetadata()}
        </>
      );
    }

    if (giftBadge) {
      return this.renderGiftBadge();
    }

    if (isTapToView) {
      return (
        <>
          {this.renderTapToView()}
          {this.#renderMetadata()}
        </>
      );
    }

    return (
      <>
        {this.renderQuote()}
        {this.renderStoryReplyContext()}
        {this.renderAttachment()}
        {this.renderPreview()}
        {this.renderAttachmentTooBig()}
        {this.renderPayment()}
        {this.renderPoll()}
        {this.renderEmbeddedContact()}
        {this.renderText()}
        {this.renderUndownloadableTextAttachment()}
        {this.#renderAction()}
        {this.#renderMetadata()}
        {this.renderSendMessageButton()}
      </>
    );
  }

  public handleOpen = (event: React.KeyboardEvent | React.MouseEvent): void => {
    const {
      attachments,
      cancelAttachmentDownload,
      contact,
      direction,
      giftBadge,
      id,
      isTapToView,
      isTapToViewError,
      isTapToViewExpired,
      kickOffAttachmentDownload,
      openGiftBadge,
      pushPanelForConversation,
      readStatus,
      showExpiredIncomingTapToViewToast,
      showExpiredOutgoingTapToViewToast,
      showLightbox,
      showLightboxForViewOnceMedia,
      startConversation,
    } = this.props;
    const { imageBroken } = this.state;

    const isAttachmentPending = this.isAttachmentPending();

    if (giftBadge && giftBadge.state === GiftBadgeStates.Unopened) {
      openGiftBadge(id);
      return;
    }

    if (isTapToView) {
      event.preventDefault();
      event.stopPropagation();

      if (direction === 'outgoing') {
        showExpiredOutgoingTapToViewToast();
        return;
      }
      if (readStatus === ReadStatus.Viewed) {
        showExpiredIncomingTapToViewToast();
        return;
      }

      if (isTapToViewError || isTapToViewExpired) {
        // The only interactive element is the Learn More button
        return;
      }

      if (attachments && !isDownloaded(attachments[0])) {
        if (isDownloading(attachments[0])) {
          cancelAttachmentDownload({ messageId: id });
        } else {
          kickOffAttachmentDownload({ messageId: id });
        }
        return;
      }

      showLightboxForViewOnceMedia(id);

      return;
    }

    if (attachments?.[0]?.isPermanentlyUndownloadable) {
      return;
    }

    if (contact && contact.firstNumber && contact.serviceId) {
      startConversation(contact.firstNumber, contact.serviceId);

      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (contact) {
      pushPanelForConversation({
        type: PanelType.ContactDetails,
        args: {
          messageId: id,
        },
      });

      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (this.isGenericAttachment(attachments, imageBroken)) {
      this.openGenericAttachment();
      return;
    }

    if (
      isAudio(attachments) &&
      this.audioButtonRef &&
      this.audioButtonRef.current
    ) {
      event.preventDefault();
      event.stopPropagation();

      this.audioButtonRef.current.click();
      return;
    }

    if (
      !imageBroken &&
      attachments &&
      attachments.length > 0 &&
      !isAttachmentPending &&
      !isDownloaded(attachments[0])
    ) {
      event.preventDefault();
      event.stopPropagation();

      kickOffAttachmentDownload({ messageId: id });

      return;
    }

    if (
      !imageBroken &&
      attachments &&
      attachments.length > 0 &&
      !isAttachmentPending &&
      canDisplayImage(attachments) &&
      ((isImage(attachments) && hasImage(attachments)) ||
        (isVideo(attachments) && hasVideoScreenshot(attachments)))
    ) {
      event.preventDefault();
      event.stopPropagation();

      const attachment = attachments[0];

      showLightbox({ attachment, messageId: id });
    }
  };

  public openGenericAttachment = (event?: React.MouseEvent): void => {
    const {
      id,
      attachments,
      saveAttachment,
      timestamp,
      kickOffAttachmentDownload,
      attachmentDroppedDueToSize,
      cancelAttachmentDownload,
    } = this.props;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const firstAttachment = attachments?.[0];
    if (!firstAttachment) {
      return;
    }
    const isAttachmentNotAvailable =
      firstAttachment.isPermanentlyUndownloadable &&
      !attachmentDroppedDueToSize;

    if (isAttachmentNotAvailable) {
      return;
    }

    if (firstAttachment.pending) {
      cancelAttachmentDownload({
        messageId: id,
      });
    } else if (!firstAttachment.path) {
      kickOffAttachmentDownload({
        messageId: id,
      });
    } else {
      saveAttachment(firstAttachment, timestamp);
    }
  };

  public handleClick = (event: React.MouseEvent): void => {
    // We don't want clicks on body text to result in the 'default action' for the message
    const { text } = this.props;
    if (text && text.length > 0) {
      return;
    }

    this.handleOpen(event);
  };

  public handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    this.handleOpen(event);
  };

  private isGenericAttachment(
    attachments: ReadonlyArray<AttachmentForUIType> | undefined,
    imageBroken: boolean
  ) {
    return (
      attachments?.length &&
      (!isImage(attachments) || !canDisplayImage(attachments) || imageBroken) &&
      (!isVideo(attachments) || !canDisplayImage(attachments) || imageBroken) &&
      !isAudio(attachments)
    );
  }

  public renderContainer(): JSX.Element {
    const {
      attachments,
      attachmentDroppedDueToSize,
      contact,
      conversationColor,
      customColor,
      deletedForEveryone,
      direction,
      id,
      isSticker,
      isTapToView,
      onContextMenu,
      text,
      textDirection,
    } = this.props;
    const { isTargeted, imageBroken } = this.state;

    const width = this.getWidth();
    const isEmojiOnly = this.#canRenderStickerLikeEmoji();
    const isStickerLike =
      isEmojiOnly ||
      (isSticker &&
        attachments &&
        attachments[0] &&
        !attachments[0].isPermanentlyUndownloadable);

    // If it's a mostly-normal gray incoming text box, we don't want to darken it as much
    const lighterSelect =
      isTargeted &&
      direction === 'incoming' &&
      !isStickerLike &&
      (text || (!isVideo(attachments) && !isImage(attachments)));
    const isClickable =
      isTapToView ||
      (this.isGenericAttachment(attachments, imageBroken) &&
        !text &&
        !attachments?.[0]?.isPermanentlyUndownloadable) ||
      contact;

    const containerClassnames = classNames(
      'module-message__container',
      isGIF(attachments) && !isTapToView
        ? 'module-message__container--gif'
        : null,
      isTargeted ? 'module-message__container--targeted' : null,
      lighterSelect ? 'module-message__container--targeted-lighter' : null,
      !isStickerLike ? `module-message__container--${direction}` : null,
      isEmojiOnly ? 'module-message__container--emoji' : null,
      !isStickerLike && direction === 'outgoing'
        ? `module-message__container--outgoing-${conversationColor}`
        : null,
      isClickable ? 'module-message__container--is-clickable' : null,
      this.#hasReactions() ? 'module-message__container--with-reactions' : null,
      deletedForEveryone
        ? 'module-message__container--deleted-for-everyone'
        : null
    );
    const containerStyles = {
      width,
    };
    if (
      !isStickerLike &&
      !deletedForEveryone &&
      !(attachmentDroppedDueToSize && !text) &&
      direction === 'outgoing'
    ) {
      Object.assign(containerStyles, getCustomColorStyle(customColor));
    }

    return (
      <div className="module-message__container-outer">
        {/* the keyboard handler is a level higher in hierarchy due to selection */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
        <div
          className={containerClassnames}
          id={`message-accessibility-contents:${id}`}
          style={containerStyles}
          onContextMenu={onContextMenu}
          role="row"
          onClick={this.handleClick}
          onDoubleClick={ev => {
            // Prevent double click from triggering the replyToMessage action
            ev.stopPropagation();
          }}
          tabIndex={-1}
        >
          {this.#renderAuthor()}
          <div dir={TextDirectionToDirAttribute[textDirection]}>
            {this.renderContents()}
          </div>
        </div>
        {this.renderReactions(direction === 'outgoing')}
      </div>
    );
  }

  renderAltAccessibilityTree(): JSX.Element {
    const { id, i18n, author } = this.props;
    return (
      <span className="module-message__alt-accessibility-tree">
        <span id={`message-accessibility-label:${id}`}>
          {author.isMe
            ? i18n('icu:messageAccessibilityLabel--outgoing')
            : i18n('icu:messageAccessibilityLabel--incoming', {
                author: author.title,
              })}
        </span>

        <span id={`message-accessibility-description:${id}`}>
          {this.renderText()}
        </span>
      </span>
    );
  }

  public override render(): JSX.Element | null {
    const {
      id,
      attachments,
      direction,
      i18n,
      isSticker,
      isSelected,
      isSelectMode,
      platform,
      renderMenu,
      shouldCollapseAbove,
      shouldCollapseBelow,
      timestamp,
      onToggleSelect,
      onReplyToMessage,
    } = this.props;
    const isMacOS = platform === 'darwin';
    const { expired, expiring, isTargeted, imageBroken } = this.state;

    if (expired) {
      return null;
    }

    if (isSticker && (imageBroken || !attachments || !attachments.length)) {
      return null;
    }

    let wrapperProps: DetailedHTMLProps<
      HTMLAttributes<HTMLDivElement>,
      HTMLDivElement
    >;

    if (isSelectMode) {
      wrapperProps = {
        role: 'checkbox',
        'aria-checked': isSelected,
        'aria-labelledby': `message-accessibility-label:${id}`,
        'aria-describedby': `message-accessibility-description:${id}`,
        tabIndex: 0,
        onClick: event => {
          event.preventDefault();
          onToggleSelect(!isSelected, event.shiftKey);
        },
        onKeyDown: event => {
          if (event.code === 'Space') {
            event.preventDefault();
            onToggleSelect(!isSelected, event.shiftKey);
          }
        },
      };
    } else {
      wrapperProps = {
        onMouseDown: () => {
          this.#hasSelectedTextRef.current = false;
        },
        // We use `onClickCapture` here and prevent default/stop propagation to
        // prevent other click handlers from firing.
        onClickCapture: event => {
          if (isMacOS ? event.metaKey : event.ctrlKey) {
            if (this.#hasSelectedTextRef.current) {
              return;
            }

            const target = event.target as HTMLElement;
            const link = target.closest('a[href], [role=link]');

            if (event.currentTarget.contains(link)) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
            onToggleSelect(true, false);
          }
        },
        onDoubleClick: event => {
          event.stopPropagation();
          event.preventDefault();
          if (!isSelectMode) {
            onReplyToMessage();
          }
        },
        onKeyDown: event => this.handleKeyDown(event),
      };
    }

    return (
      <div
        aria-labelledby={`message-accessibility-contents:${id}`}
        aria-roledescription={i18n('icu:Message__role-description')}
        className={classNames(
          'module-message__wrapper',
          isSelectMode && 'module-message__wrapper--select-mode',
          isSelected && 'module-message__wrapper--selected'
        )}
        role="article"
        {...wrapperProps}
      >
        {isSelectMode && (
          <>
            <span
              role="presentation"
              className="module-message__select-checkbox"
            />
            {this.renderAltAccessibilityTree()}
          </>
        )}
        <div
          className={classNames(
            'module-message',
            `module-message--${direction}`,
            shouldCollapseAbove && 'module-message--collapsed-above',
            shouldCollapseBelow && 'module-message--collapsed-below',
            isTargeted ? 'module-message--targeted' : null,
            expiring ? 'module-message--expired' : null
          )}
          data-testid={timestamp}
          tabIndex={0}
          // We need to have a role because screenreaders need to be able to focus here to
          //   read the message, but we can't be a button; that would break inner buttons.
          role="row"
          onFocus={this.handleFocus}
          ref={this.focusRef}
          // @ts-expect-error -- React/TS doesn't know about inert
          // eslint-disable-next-line react/no-unknown-property
          inert={isSelectMode ? '' : undefined}
        >
          {this.#renderError()}
          {this.#renderAvatar()}
          {this.renderContainer()}
          {renderMenu?.()}
        </div>
      </div>
    );
  }
}
