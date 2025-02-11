// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react/jsx-pascal-case */

import type {
  DetailedHTMLProps,
  HTMLAttributes,
  ReactNode,
  RefObject,
} from 'react';
import React from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import getDirection from 'direction';
import { drop, groupBy, orderBy, take, unescape } from 'lodash';
import { Manager, Popper, Reference } from 'react-popper';
import type { PreventOverflowModifier } from '@popperjs/core/lib/modifiers/preventOverflow';
import type { ReadonlyDeep } from 'type-fest';

import type {
  ConversationType,
  ConversationTypeType,
  InteractionModeType,
  PushPanelForConversationActionType,
  SaveAttachmentActionCreatorType,
  SaveAttachmentsActionCreatorType,
  ShowConversationType,
} from '../../state/ducks/conversations';
import type { ViewStoryActionCreatorType } from '../../state/ducks/stories';
import type { ReadStatus } from '../../messages/MessageReadStatus';
import { Avatar, AvatarSize } from '../Avatar';
import { AvatarSpacer } from '../AvatarSpacer';
import { Spinner } from '../Spinner';
import { MessageBodyReadMore } from './MessageBodyReadMore';
import { MessageMetadata } from './MessageMetadata';
import { MessageTextMetadataSpacer } from './MessageTextMetadataSpacer';
import { ImageGrid } from './ImageGrid';
import { GIF } from './GIF';
import { CurveType, Image } from './Image';
import { ContactName } from './ContactName';
import type { QuotedAttachmentForUIType } from './Quote';
import { Quote } from './Quote';
import { EmbeddedContact } from './EmbeddedContact';
import type { OwnProps as ReactionViewerProps } from './ReactionViewer';
import { ReactionViewer } from './ReactionViewer';
import { Emoji } from '../emoji/Emoji';
import { LinkPreviewDate } from './LinkPreviewDate';
import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import { shouldUseFullSizeLinkPreviewImage } from '../../linkPreviews/shouldUseFullSizeLinkPreviewImage';
import type { WidthBreakpoint } from '../_util';
import { OutgoingGiftBadgeModal } from '../OutgoingGiftBadgeModal';
import * as log from '../../logging/log';
import { StoryViewModeType } from '../../types/Stories';
import type {
  AttachmentForUIType,
  AttachmentType,
} from '../../types/Attachment';
import {
  canDisplayImage,
  getExtensionForDisplay,
  getGridDimensions,
  getImageDimensions,
  hasImage,
  isDownloaded,
  hasVideoScreenshot,
  isAudio,
  isImage,
  isImageAttachment,
  isVideo,
  isGIF,
  isPlayed,
  isPermanentlyUndownloadable,
  canRenderAudio,
} from '../../types/Attachment';
import type { EmbeddedContactType } from '../../types/EmbeddedContact';

import { getIncrement } from '../../util/timer';
import { clearTimeoutIfNecessary } from '../../util/clearTimeoutIfNecessary';
import { isFileDangerous } from '../../util/isFileDangerous';
import { missingCaseError } from '../../util/missingCaseError';
import type { HydratedBodyRangesType } from '../../types/BodyRange';
import type { LocalizerType, ThemeType } from '../../types/Util';

import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import type {
  ContactNameColorType,
  ConversationColorType,
  CustomColorType,
} from '../../types/Colors';
import { createRefMerger } from '../../util/refMerger';
import { emojiToData, getEmojiCount, hasNonEmojiText } from '../emoji/lib';
import { getCustomColorStyle } from '../../util/getCustomColorStyle';
import type { ServiceIdString } from '../../types/ServiceId';
import { DAY, HOUR, MINUTE, SECOND } from '../../util/durations';
import { BadgeImageTheme } from '../../badges/BadgeImageTheme';
import { getBadgeImageFileLocalPath } from '../../badges/getBadgeImageFileLocalPath';
import { handleOutsideClick } from '../../util/handleOutsideClick';
import { isPaymentNotificationEvent } from '../../types/Payment';
import type { AnyPaymentEvent } from '../../types/Payment';
import { getPaymentEventDescription } from '../../messages/helpers';
import { PanelType } from '../../types/Panels';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser';
import { RenderLocation } from './MessageTextRenderer';
import { UserText } from '../UserText';
import { getColorForCallLink } from '../../util/getColorForCallLink';
import { getKeyFromCallLink } from '../../util/callLinks';
import { InAnotherCallTooltip } from './InAnotherCallTooltip';
import { formatFileSize } from '../../util/formatFileSize';
import { AttachmentNotAvailableModalType } from '../AttachmentNotAvailableModal';
import { assertDev } from '../../util/assert';

const GUESS_METADATA_WIDTH_TIMESTAMP_SIZE = 16;
const GUESS_METADATA_WIDTH_EXPIRE_TIMER_SIZE = 18;
const GUESS_METADATA_WIDTH_SMS_SIZE = 18;
const GUESS_METADATA_WIDTH_EDITED_SIZE = 40;
const GUESS_METADATA_WIDTH_OUTGOING_SIZE: Record<MessageStatusType, number> = {
  delivered: 24,
  error: 24,
  paused: 18,
  'partial-sent': 24,
  read: 24,
  sending: 18,
  sent: 24,
  viewed: 24,
};

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
  RenderedByMessageAudioComponent,
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

export const MessageStatuses = [
  'delivered',
  'error',
  'paused',
  'partial-sent',
  'read',
  'sending',
  'sent',
  'viewed',
] as const;
export type MessageStatusType = (typeof MessageStatuses)[number];

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
  onCorrupted(): void;
};

export enum GiftBadgeStates {
  Unopened = 'Unopened',
  Opened = 'Opened',
  Redeemed = 'Redeemed',
  Failed = 'Failed',
}

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
  contact?: ReadonlyDeep<EmbeddedContactType>;
  author: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'badges'
    | 'color'
    | 'id'
    | 'isMe'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
    | 'unblurredAvatarUrl'
  >;
  conversationType: ConversationTypeType;
  attachments?: ReadonlyArray<AttachmentForUIType>;
  giftBadge?: GiftBadgeType;
  payment?: AnyPaymentEvent;
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
  previews: ReadonlyArray<LinkPreviewType>;

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
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;

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
  showAttachmentNotAvailableModal: (
    modalType: AttachmentNotAvailableModalType
  ) => void;
  showExpiredIncomingTapToViewToast: () => unknown;
  showExpiredOutgoingTapToViewToast: () => unknown;
  showMediaNoLongerAvailableToast: () => unknown;
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

export class Message extends React.PureComponent<Props, State> {
  public focusRef: React.RefObject<HTMLDivElement> = React.createRef();

  public audioButtonRef: React.RefObject<HTMLButtonElement> = React.createRef();

  public reactionsContainerRef: React.RefObject<HTMLDivElement> =
    React.createRef();

  #hasSelectedTextRef: React.MutableRefObject<boolean> = {
    current: false,
  };

  #metadataRef: React.RefObject<HTMLDivElement> = React.createRef();

  public reactionsContainerRefMerger = createRefMerger();

  public expirationCheckInterval: NodeJS.Timeout | undefined;

  public giftBadgeInterval: NodeJS.Timeout | undefined;

  public expiredTimeout: NodeJS.Timeout | undefined;

  public targetedTimeout: NodeJS.Timeout | undefined;

  public deleteForEveryoneTimeout: NodeJS.Timeout | undefined;

  public constructor(props: Props) {
    super(props);

    this.state = {
      metadataWidth: this.#guessMetadataWidth(),

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
    log.info(
      `Message ${id}: Image failed to load; failing over to placeholder`
    );
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
        `Message.tsx: Rendered 'send complete' for message ${timestamp}; took ${delta}ms`
      );
    }
  }

  #getMetadataPlacement(
    {
      attachments,
      attachmentDroppedDueToSize,
      deletedForEveryone,
      direction,
      expirationLength,
      expirationTimestamp,
      giftBadge,
      i18n,
      shouldHideMetadata,
      status,
      text,
    }: Readonly<Props> = this.props
  ): MetadataPlacement {
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

    if (!text && !deletedForEveryone && !attachmentDroppedDueToSize) {
      return canRenderAudio(attachments)
        ? MetadataPlacement.RenderedByMessageAudioComponent
        : MetadataPlacement.Bottom;
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

  /**
   * A lot of the time, we add an invisible inline spacer for messages. This spacer is the
   * same size as the message metadata. Unfortunately, we don't know how wide it is until
   * we render it.
   *
   * This will probably guess wrong, but it's valuable to get close to the real value
   * because it can reduce layout jumpiness.
   */
  #guessMetadataWidth(): number {
    const { direction, expirationLength, isSMS, status, isEditedMessage } =
      this.props;

    let result = GUESS_METADATA_WIDTH_TIMESTAMP_SIZE;

    if (isEditedMessage) {
      result += GUESS_METADATA_WIDTH_EDITED_SIZE;
    }

    const hasExpireTimer = Boolean(expirationLength);
    if (hasExpireTimer) {
      result += GUESS_METADATA_WIDTH_EXPIRE_TIMER_SIZE;
    }

    if (isSMS) {
      result += GUESS_METADATA_WIDTH_SMS_SIZE;
    }

    if (direction === 'outgoing' && status) {
      result += GUESS_METADATA_WIDTH_OUTGOING_SIZE[status];
    }

    return result;
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

  #canRenderStickerLikeEmoji(): boolean {
    const {
      attachments,
      bodyRanges,
      previews,
      quote,
      storyReplyContext,
      text,
    } = this.props;

    return Boolean(
      text &&
        !hasNonEmojiText(text) &&
        getEmojiCount(text) < 6 &&
        !quote &&
        !storyReplyContext &&
        (!attachments || !attachments.length) &&
        (!bodyRanges || !bodyRanges.length) &&
        (!previews || !previews.length)
    );
  }

  #updateMetadataWidth = (newMetadataWidth: number): void => {
    this.setState(({ metadataWidth }) => ({
      // We don't want text to jump around if the metadata shrinks, but we want to make
      //   sure we have enough room.
      metadataWidth: Math.max(metadataWidth, newMetadataWidth),
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
      case MetadataPlacement.RenderedByMessageAudioComponent:
        return null;
      case MetadataPlacement.InlineWithText:
        isInline = true;
        break;
      case MetadataPlacement.Bottom:
        isInline = false;
        break;
      default:
        log.error(missingCaseError(metadataPlacement));
        isInline = false;
        break;
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
      isTapToViewExpired,
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
        isTapToViewExpired={isTapToViewExpired}
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
    const {
      author,
      contactNameColor,
      i18n,
      isSticker,
      isTapToView,
      isTapToViewExpired,
    } = this.props;

    if (!this.#shouldRenderAuthor()) {
      return null;
    }

    const withTapToViewExpired = isTapToView && isTapToViewExpired;

    const stickerSuffix = isSticker ? '_with_sticker' : '';
    const tapToViewSuffix = withTapToViewExpired
      ? '--with-tap-to-view-expired'
      : '';
    const moduleName = `module-message__author${stickerSuffix}${tapToViewSuffix}`;

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
      attachments,
      attachmentDroppedDueToSize,
      cancelAttachmentDownload,
      conversationId,
      direction,
      expirationLength,
      expirationTimestamp,
      _forceTapToPlay,
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
      shouldCollapseAbove,
      shouldCollapseBelow,
      showAttachmentNotAvailableModal,
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
      isPermanentlyUndownloadable(firstAttachment) &&
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

      if (isImage(attachments) || isVideo(attachments)) {
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
      let attachmentType: string;
      let info: string;
      let modalType: AttachmentNotAvailableModalType;
      if (isAttachmentAudio) {
        attachmentType = 'audio';
        info = i18n('icu:attachmentNotAvailable__voice');
        modalType = AttachmentNotAvailableModalType.VoiceMessage;
      } else if (isSticker) {
        attachmentType = 'sticker';
        info = i18n('icu:attachmentNotAvailable__sticker');
        modalType = AttachmentNotAvailableModalType.Sticker;
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
            <div className="module-message__undownloadable-attachment-learn-more-container">
              <button
                className="module-message__undownloadable-attachment-learn-more"
                onClick={e => {
                  e.stopPropagation();
                  e.preventDefault();
                  showAttachmentNotAvailableModal(modalType);
                }}
                type="button"
              >
                {i18n('icu:attachmentNoLongerAvailable__learnMore')}
              </button>
            </div>
          </div>
        </div>
      );
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

    const { pending, fileName, size, contentType } = firstAttachment;
    const extension = getExtensionForDisplay({ contentType, fileName });
    const isDangerous = isFileDangerous(fileName || '');

    return (
      <button
        type="button"
        className={classNames(
          'module-message__generic-attachment',
          withContentBelow
            ? 'module-message__generic-attachment--with-content-below'
            : null,
          withContentAbove
            ? 'module-message__generic-attachment--with-content-above'
            : null,
          isAttachmentNotAvailable
            ? 'module-message__generic-attachment--undownloadable'
            : null,
          isAttachmentNotAvailable && !text
            ? 'module-message__generic-attachment--undownloadable-no-text'
            : null
        )}
        // There's only ever one of these, so we don't want users to tab into it
        tabIndex={-1}
        onClick={event => {
          event.stopPropagation();
          event.preventDefault();

          if (!isDownloaded(firstAttachment)) {
            if (isAttachmentNotAvailable) {
              showAttachmentNotAvailableModal(
                AttachmentNotAvailableModalType.File
              );
            } else {
              kickOffAttachmentDownload({
                messageId: id,
              });
            }
          } else {
            this.openGenericAttachment();
          }
        }}
      >
        {pending ? (
          <div className="module-message__generic-attachment__spinner-container">
            <Spinner svgSize="small" size="24px" direction={direction} />
          </div>
        ) : (
          <div className="module-message__generic-attachment__icon-container">
            <div className="module-message__generic-attachment__icon">
              {extension ? (
                <div className="module-message__generic-attachment__icon__extension">
                  {extension}
                </div>
              ) : null}
            </div>
            {isDangerous ? (
              <div className="module-message__generic-attachment__icon-dangerous-container">
                <div className="module-message__generic-attachment__icon-dangerous" />
              </div>
            ) : null}
          </div>
        )}
        <div className="module-message__generic-attachment__text">
          <div
            className={classNames(
              'module-message__generic-attachment__file-name',
              `module-message__generic-attachment__file-name--${direction}`,
              isAttachmentNotAvailable
                ? 'module-message__generic-attachment__file-name--undownloadable'
                : null
            )}
          >
            {fileName}
          </div>
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
                'module-message__generic-attachment__file-size',
                `module-message__generic-attachment__file-size--${direction}`
              )}
            >
              {formatFileSize(size)}
            </div>
          )}
        </div>
      </button>
    );
  }

  public renderUndownloadableTextAttachment(): JSX.Element | null {
    const { i18n, textAttachment, showAttachmentNotAvailableModal } =
      this.props;
    if (!textAttachment || !isPermanentlyUndownloadable(textAttachment)) {
      return null;
    }

    return (
      <button
        type="button"
        className="module-message__generic-attachment module-message__undownloadable-attachment-text"
        tabIndex={-1}
        onClick={event => {
          event.stopPropagation();
          event.preventDefault();
          showAttachmentNotAvailableModal(
            AttachmentNotAvailableModalType.LongText
          );
        }}
      >
        <div className="module-message__undownloadable-attachment-text__icon-container">
          <div className="module-message__undownloadable-attachment__icon module-message__undownloadable-attachment__icon--file" />
        </div>
        <div>
          <div className="module-message__undownloadable-attachment-info">
            {i18n('icu:attachmentNotAvailable__longMessage')}
          </div>
          <div className="module-message__undownloadable-attachment-learn-more-container">
            <div className="module-message__undownloadable-attachment-learn-more">
              {i18n('icu:attachmentNoLongerAvailable__learnMore')}
            </div>
          </div>
        </div>
      </button>
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
                acceptedMessageRequest
                badge={undefined}
                color={getColorForCallLink(getKeyFromCallLink(first.url))}
                conversationType="callLink"
                i18n={i18n}
                isMe={false}
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

  public renderQuote(): JSX.Element | null {
    const {
      conversationColor,
      conversationId,
      conversationTitle,
      customColor,
      direction,
      disableScroll,
      doubleCheckMissingQuoteReference,
      i18n,
      id,
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
        doubleCheckMissingQuoteReference={() =>
          doubleCheckMissingQuoteReference(id)
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
      contact,
      conversationType,
      direction,
      i18n,
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
    const tabIndex = otherContent ? 0 : -1;

    return (
      <EmbeddedContact
        contact={contact}
        isIncoming={direction === 'incoming'}
        i18n={i18n}
        onClick={() => {
          const signalAccount =
            contact.firstNumber && contact.serviceId
              ? {
                  phoneNumber: contact.firstNumber,
                  serviceId: contact.serviceId,
                }
              : undefined;

          pushPanelForConversation({
            type: PanelType.ContactDetails,
            args: {
              contact,
              signalAccount,
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
            acceptedMessageRequest={author.acceptedMessageRequest}
            avatarUrl={author.avatarUrl}
            badge={getPreferredBadge(author.badges)}
            color={author.color}
            conversationType="direct"
            i18n={i18n}
            isMe={author.isMe}
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
            unblurredAvatarUrl={author.unblurredAvatarUrl}
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
    const { attachments, giftBadge, isSticker, previews } = this.props;

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
      const dimensions = getImageDimensions(firstLinkPreview.image);
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
    const { direction, isTapToViewExpired } = this.props;
    const isDownloadPending = this.isAttachmentPending();

    return !isTapToViewExpired && isDownloadPending ? (
      <div className="module-message__tap-to-view__spinner-container">
        <Spinner svgSize="small" size="20px" direction={direction} />
      </div>
    ) : (
      <div
        className={classNames(
          'module-message__tap-to-view__icon',
          `module-message__tap-to-view__icon--${direction}`,
          isTapToViewExpired
            ? 'module-message__tap-to-view__icon--expired'
            : null
        )}
      />
    );
  }

  public renderTapToViewText(): string | undefined {
    const {
      attachments,
      direction,
      i18n,
      isTapToViewExpired,
      isTapToViewError,
    } = this.props;

    const isDownloadPending = this.isAttachmentPending();
    if (isDownloadPending) {
      return;
    }
    if (isTapToViewError) {
      return i18n('icu:incomingError');
    }
    if (direction === 'outgoing') {
      return i18n('icu:Message--tap-to-view--outgoing');
    }
    if (isTapToViewExpired) {
      return i18n('icu:Message--tap-to-view-expired');
    }
    if (isVideo(attachments)) {
      return i18n('icu:Message--tap-to-view--incoming-video');
    }
    return i18n('icu:Message--tap-to-view--incoming');
  }

  public renderTapToView(): JSX.Element {
    const {
      conversationType,
      direction,
      isTapToViewExpired,
      isTapToViewError,
    } = this.props;

    const collapseMetadata =
      this.#getMetadataPlacement() === MetadataPlacement.NotRendered;
    const withContentBelow = !collapseMetadata;
    const withContentAbove =
      !collapseMetadata &&
      conversationType === 'group' &&
      direction === 'incoming';

    return (
      <div
        className={classNames(
          'module-message__tap-to-view',
          withContentBelow
            ? 'module-message__tap-to-view--with-content-below'
            : null,
          withContentAbove
            ? 'module-message__tap-to-view--with-content-above'
            : null
        )}
      >
        {isTapToViewError ? null : this.renderTapToViewIcon()}
        <div
          className={classNames(
            'module-message__tap-to-view__text',
            `module-message__tap-to-view__text--${direction}`,
            isTapToViewExpired
              ? `module-message__tap-to-view__text--${direction}-expired`
              : null,
            isTapToViewError
              ? `module-message__tap-to-view__text--${direction}-error`
              : null
          )}
        >
          {this.renderTapToViewText()}
        </div>
      </div>
    );
  }

  #popperPreventOverflowModifier(): Partial<PreventOverflowModifier> {
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
  }

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

    const reactionsWithEmojiData = reactions.map(reaction => ({
      ...reaction,
      ...emojiToData(reaction.emoji),
    }));

    // Group by emoji and order each group by timestamp descending
    const groupedAndSortedReactions = Object.values(
      groupBy(reactionsWithEmojiData, 'short_name')
    ).map(groupedReactions =>
      orderBy(
        groupedReactions,
        [reaction => reaction.from.isMe, 'timestamp'],
        ['desc', 'desc']
      )
    );
    // Order groups by length and subsequently by most recent reaction
    const ordered = orderBy(
      groupedAndSortedReactions,
      ['length', ([{ timestamp }]) => timestamp],
      ['desc', 'desc']
    );
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

    const { reactionViewerRoot } = this.state;

    const popperPlacement = outgoing ? 'bottom-end' : 'bottom-start';

    return (
      <Manager>
        <Reference>
          {({ ref: popperRef }) => (
            <div
              ref={this.reactionsContainerRefMerger(
                this.reactionsContainerRef,
                popperRef
              )}
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
                      this.toggleReactionViewer(false);
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
                        <Emoji size={16} emoji={re.emoji} />
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
              modifiers={[this.#popperPreventOverflowModifier()]}
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
                  onClose={this.toggleReactionViewer}
                  theme={theme}
                />
              )}
            </Popper>,
            reactionViewerRoot
          )}
      </Manager>
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
        {this.renderEmbeddedContact()}
        {this.renderText()}
        {this.renderUndownloadableTextAttachment()}
        {this.#renderAction()}
        {this.#renderMetadata()}
        {this.renderSendMessageButton()}
      </>
    );
  }

  public handleOpen = (
    event: React.KeyboardEvent<HTMLDivElement> | React.MouseEvent
  ): void => {
    const {
      attachments,
      contact,
      showLightboxForViewOnceMedia,
      direction,
      giftBadge,
      id,
      isSticker,
      isTapToView,
      isTapToViewExpired,
      kickOffAttachmentDownload,
      startConversation,
      openGiftBadge,
      pushPanelForConversation,
      showAttachmentNotAvailableModal,
      showLightbox,
      showExpiredIncomingTapToViewToast,
      showExpiredOutgoingTapToViewToast,
      showMediaNoLongerAvailableToast,
    } = this.props;
    const { imageBroken } = this.state;

    const isAttachmentPending = this.isAttachmentPending();

    if (giftBadge && giftBadge.state === GiftBadgeStates.Unopened) {
      openGiftBadge(id);
      return;
    }

    if (
      attachments &&
      attachments.length > 0 &&
      isPermanentlyUndownloadable(attachments[0])
    ) {
      event.preventDefault();
      event.stopPropagation();

      // This needs to be the first check because canDisplayImage is true for stickers
      if (isSticker) {
        showAttachmentNotAvailableModal(
          AttachmentNotAvailableModalType.Sticker
        );
      } else if (canDisplayImage(attachments)) {
        showMediaNoLongerAvailableToast();
      } else if (isAudio(attachments)) {
        showAttachmentNotAvailableModal(
          AttachmentNotAvailableModalType.VoiceMessage
        );
      } else {
        showAttachmentNotAvailableModal(AttachmentNotAvailableModalType.File);
      }

      return;
    }

    if (isTapToView) {
      if (isAttachmentPending) {
        log.info(
          '<Message> handleOpen: tap-to-view attachment is pending; not showing the lightbox'
        );
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (isTapToViewExpired) {
        const action =
          direction === 'outgoing'
            ? showExpiredOutgoingTapToViewToast
            : showExpiredIncomingTapToViewToast;
        action();

        return;
      }

      if (attachments && !isDownloaded(attachments[0])) {
        kickOffAttachmentDownload({ messageId: id });

        return;
      }

      showLightboxForViewOnceMedia(id);

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

      return;
    }

    if (
      attachments &&
      attachments.length === 1 &&
      !isAttachmentPending &&
      !isAudio(attachments)
    ) {
      event.preventDefault();
      event.stopPropagation();

      this.openGenericAttachment();

      return;
    }

    if (
      !isAttachmentPending &&
      isAudio(attachments) &&
      this.audioButtonRef &&
      this.audioButtonRef.current
    ) {
      event.preventDefault();
      event.stopPropagation();

      this.audioButtonRef.current.click();
      return;
    }

    if (contact && contact.firstNumber && contact.serviceId) {
      startConversation(contact.firstNumber, contact.serviceId);

      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (contact) {
      const signalAccount =
        contact.firstNumber && contact.serviceId
          ? {
              phoneNumber: contact.firstNumber,
              serviceId: contact.serviceId,
            }
          : undefined;
      pushPanelForConversation({
        type: PanelType.ContactDetails,
        args: {
          contact,
          signalAccount,
        },
      });

      event.preventDefault();
      event.stopPropagation();
    }
  };

  public openGenericAttachment = (event?: React.MouseEvent): void => {
    const {
      id,
      attachments,
      saveAttachment,
      timestamp,
      kickOffAttachmentDownload,
    } = this.props;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!attachments || attachments.length !== 1) {
      return;
    }

    const attachment = attachments[0];
    if (!isDownloaded(attachment)) {
      kickOffAttachmentDownload({ messageId: id });
      return;
    }

    saveAttachment(attachment, timestamp);
  };

  public handleClick = (event: React.MouseEvent): void => {
    // We don't want clicks on body text to result in the 'default action' for the message
    const { text } = this.props;
    if (text && text.length > 0) {
      return;
    }

    this.handleOpen(event);
  };

  public renderContainer(): JSX.Element {
    const {
      attachments,
      attachmentDroppedDueToSize,
      conversationColor,
      customColor,
      deletedForEveryone,
      direction,
      id,
      isSticker,
      isTapToView,
      isTapToViewExpired,
      isTapToViewError,
      onContextMenu,
      onKeyDown,
      text,
      textDirection,
    } = this.props;
    const { isTargeted } = this.state;

    const isAttachmentPending = this.isAttachmentPending();
    const width = this.getWidth();
    const isEmojiOnly = this.#canRenderStickerLikeEmoji();
    const isStickerLike =
      isEmojiOnly ||
      (isSticker &&
        attachments &&
        attachments[0] &&
        !isPermanentlyUndownloadable(attachments[0]));

    // If it's a mostly-normal gray incoming text box, we don't want to darken it as much
    const lighterSelect =
      isTargeted &&
      direction === 'incoming' &&
      !isStickerLike &&
      (text || (!isVideo(attachments) && !isImage(attachments)));

    const containerClassnames = classNames(
      'module-message__container',
      isGIF(attachments) ? 'module-message__container--gif' : null,
      isTargeted ? 'module-message__container--targeted' : null,
      lighterSelect ? 'module-message__container--targeted-lighter' : null,
      !isStickerLike ? `module-message__container--${direction}` : null,
      isEmojiOnly ? 'module-message__container--emoji' : null,
      isTapToView ? 'module-message__container--with-tap-to-view' : null,
      isTapToView && isTapToViewExpired
        ? 'module-message__container--with-tap-to-view-expired'
        : null,
      !isStickerLike && direction === 'outgoing'
        ? `module-message__container--outgoing-${conversationColor}`
        : null,
      isTapToView && isAttachmentPending && !isTapToViewExpired
        ? 'module-message__container--with-tap-to-view-pending'
        : null,
      isTapToView && isAttachmentPending && !isTapToViewExpired
        ? `module-message__container--${direction}-${conversationColor}-tap-to-view-pending`
        : null,
      isTapToViewError
        ? 'module-message__container--with-tap-to-view-error'
        : null,
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
        <div
          className={containerClassnames}
          id={`message-accessibility-contents:${id}`}
          style={containerStyles}
          onContextMenu={onContextMenu}
          role="row"
          onKeyDown={onKeyDown}
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
      onKeyDown,
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
        // We use `onClickCapture` here and preven default/stop propagation to
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
          onKeyDown={onKeyDown}
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
