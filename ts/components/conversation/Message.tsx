// Copyright 2018-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, RefObject } from 'react';
import React from 'react';
import { createPortal } from 'react-dom';
import classNames from 'classnames';
import getDirection from 'direction';
import { drop, groupBy, noop, orderBy, take, unescape } from 'lodash';
import { Manager, Popper, Reference } from 'react-popper';
import type { PreventOverflowModifier } from '@popperjs/core/lib/modifiers/preventOverflow';

import type {
  ConversationType,
  ConversationTypeType,
  InteractionModeType,
  PushPanelForConversationActionType,
  SaveAttachmentActionCreatorType,
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
import type { QuotedAttachmentType } from './Quote';
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
import type { AttachmentType } from '../../types/Attachment';
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
} from '../../types/Attachment';
import type { EmbeddedContactType } from '../../types/EmbeddedContact';

import { getIncrement } from '../../util/timer';
import { clearTimeoutIfNecessary } from '../../util/clearTimeoutIfNecessary';
import { isFileDangerous } from '../../util/isFileDangerous';
import { missingCaseError } from '../../util/missingCaseError';
import type {
  HydratedBodyRangesType,
  LocalizerType,
  ThemeType,
} from '../../types/Util';

import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import type {
  ContactNameColorType,
  ConversationColorType,
  CustomColorType,
} from '../../types/Colors';
import { createRefMerger } from '../../util/refMerger';
import { emojiToData, getEmojiCount } from '../emoji/lib';
import { isEmojiOnlyText } from '../../util/isEmojiOnlyText';
import { getCustomColorStyle } from '../../util/getCustomColorStyle';
import type { UUIDStringType } from '../../types/UUID';
import { DAY, HOUR, MINUTE, SECOND } from '../../util/durations';
import { BadgeImageTheme } from '../../badges/BadgeImageTheme';
import { getBadgeImageFileLocalPath } from '../../badges/getBadgeImageFileLocalPath';
import { handleOutsideClick } from '../../util/handleOutsideClick';
import { PaymentEventKind } from '../../types/Payment';
import type { AnyPaymentEvent } from '../../types/Payment';
import { Emojify } from './Emojify';
import { getPaymentEventDescription } from '../../messages/helpers';
import { PanelType } from '../../types/Panels';

const GUESS_METADATA_WIDTH_TIMESTAMP_SIZE = 10;
const GUESS_METADATA_WIDTH_EXPIRE_TIMER_SIZE = 18;
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
const SELECTED_TIMEOUT = 1200;
const THREE_HOURS = 3 * 60 * 60 * 1000;
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
export type MessageStatusType = typeof MessageStatuses[number];

export const Directions = ['incoming', 'outgoing'] as const;
export type DirectionType = typeof Directions[number];

export type AudioAttachmentProps = {
  renderingContext: string;
  i18n: LocalizerType;
  buttonRef: React.RefObject<HTMLButtonElement>;
  theme: ThemeType | undefined;
  attachment: AttachmentType;
  collapseMetadata: boolean;
  withContentAbove: boolean;
  withContentBelow: boolean;

  direction: DirectionType;
  expirationLength?: number;
  expirationTimestamp?: number;
  id: string;
  conversationId: string;
  played: boolean;
  showMessageDetail: (id: string) => void;
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
}
export type GiftBadgeType = {
  expiration: number;
  id: string | undefined;
  level: number;
  state: GiftBadgeStates;
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
  text?: string;
  textDirection: TextDirection;
  textAttachment?: AttachmentType;
  isSticker?: boolean;
  isSelected?: boolean;
  isSelectedCounter?: number;
  direction: DirectionType;
  timestamp: number;
  status?: MessageStatusType;
  contact?: EmbeddedContactType;
  author: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'badges'
    | 'color'
    | 'id'
    | 'isMe'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
    | 'unblurredAvatarPath'
  >;
  reducedMotion?: boolean;
  conversationType: ConversationTypeType;
  attachments?: Array<AttachmentType>;
  giftBadge?: GiftBadgeType;
  payment?: AnyPaymentEvent;
  quote?: {
    conversationColor: ConversationColorType;
    conversationTitle: string;
    customColor?: CustomColorType;
    text: string;
    rawAttachment?: QuotedAttachmentType;
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
    rawAttachment?: QuotedAttachmentType;
    storyId?: string;
    text: string;
  };
  previews: Array<LinkPreviewType>;

  isTapToView?: boolean;
  isTapToViewExpired?: boolean;
  isTapToViewError?: boolean;

  readStatus?: ReadStatus;

  expirationLength?: number;
  expirationTimestamp?: number;

  reactions?: ReactionViewerProps['reactions'];

  deletedForEveryone?: boolean;

  canDeleteForEveryone: boolean;
  isBlocked: boolean;
  isMessageRequestAccepted: boolean;
  bodyRanges?: HydratedBodyRangesType;

  menu: JSX.Element | undefined;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
};

export type PropsHousekeeping = {
  containerElementRef: RefObject<HTMLElement>;
  containerWidthBreakpoint: WidthBreakpoint;
  disableScroll?: boolean;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  interactionMode: InteractionModeType;
  renderAudioAttachment: (props: AudioAttachmentProps) => JSX.Element;
  shouldCollapseAbove: boolean;
  shouldCollapseBelow: boolean;
  shouldHideMetadata: boolean;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  theme: ThemeType;
};

export type PropsActions = {
  clearSelectedMessage: () => unknown;
  doubleCheckMissingQuoteReference: (messageId: string) => unknown;
  messageExpanded: (id: string, displayLimit: number) => unknown;
  checkForAccount: (phoneNumber: string) => unknown;

  showMessageDetail: (id: string) => void;

  startConversation: (e164: string, uuid: UUIDStringType) => void;
  showConversation: ShowConversationType;
  openGiftBadge: (messageId: string) => void;
  pushPanelForConversation: PushPanelForConversationActionType;
  showContactModal: (contactId: string, conversationId?: string) => void;

  kickOffAttachmentDownload: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  markAttachmentAsCorrupted: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  markViewed(messageId: string): void;
  saveAttachment: SaveAttachmentActionCreatorType;
  showLightbox: (options: {
    attachment: AttachmentType;
    messageId: string;
  }) => void;
  showLightboxForViewOnceMedia: (messageId: string) => unknown;

  openLink: (url: string) => void;
  scrollToQuotedMessage: (options: {
    authorId: string;
    sentAt: number;
  }) => void;
  selectMessage?: (messageId: string, conversationId: string) => unknown;

  showExpiredIncomingTapToViewToast: () => unknown;
  showExpiredOutgoingTapToViewToast: () => unknown;
  viewStory: ViewStoryActionCreatorType;
};

export type Props = PropsData & PropsHousekeeping & PropsActions;

type State = {
  metadataWidth: number;

  expiring: boolean;
  expired: boolean;
  imageBroken: boolean;

  isSelected?: boolean;
  prevSelectedCounter?: number;

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

  public reactionsContainerRefMerger = createRefMerger();

  public expirationCheckInterval: NodeJS.Timeout | undefined;

  public giftBadgeInterval: NodeJS.Timeout | undefined;

  public expiredTimeout: NodeJS.Timeout | undefined;

  public selectedTimeout: NodeJS.Timeout | undefined;

  public deleteForEveryoneTimeout: NodeJS.Timeout | undefined;

  public constructor(props: Props) {
    super(props);

    this.state = {
      metadataWidth: this.guessMetadataWidth(),

      expiring: false,
      expired: false,
      imageBroken: false,

      isSelected: props.isSelected,
      prevSelectedCounter: props.isSelectedCounter,

      reactionViewerRoot: null,

      giftBadgeCounter: null,
      showOutgoingGiftBadgeModal: false,

      hasDeleteForEveryoneTimerExpired:
        this.getTimeRemainingForDeleteForEveryone() <= 0,
    };
  }

  public static getDerivedStateFromProps(props: Props, state: State): State {
    if (!props.isSelected) {
      return {
        ...state,
        isSelected: false,
        prevSelectedCounter: 0,
      };
    }

    if (
      props.isSelected &&
      props.isSelectedCounter !== state.prevSelectedCounter
    ) {
      return {
        ...state,
        isSelected: props.isSelected,
        prevSelectedCounter: props.isSelectedCounter,
      };
    }

    return state;
  }

  private hasReactions(): boolean {
    const { reactions } = this.props;
    return Boolean(reactions && reactions.length);
  }

  public handleFocus = (): void => {
    const { interactionMode, isSelected } = this.props;

    if (interactionMode === 'keyboard' && !isSelected) {
      this.setSelected();
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

  public setSelected = (): void => {
    const { id, conversationId, selectMessage } = this.props;

    if (selectMessage) {
      selectMessage(id, conversationId);
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

    this.startSelectedTimer();
    this.startDeleteForEveryoneTimerIfApplicable();
    this.startGiftBadgeInterval();

    const { isSelected } = this.props;
    if (isSelected) {
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
    if (contact && contact.firstNumber && !contact.uuid) {
      checkForAccount(contact.firstNumber);
    }
  }

  public override componentWillUnmount(): void {
    clearTimeoutIfNecessary(this.selectedTimeout);
    clearTimeoutIfNecessary(this.expirationCheckInterval);
    clearTimeoutIfNecessary(this.expiredTimeout);
    clearTimeoutIfNecessary(this.deleteForEveryoneTimeout);
    clearTimeoutIfNecessary(this.giftBadgeInterval);
    this.toggleReactionViewer(true);
  }

  public override componentDidUpdate(prevProps: Readonly<Props>): void {
    const { isSelected, status, timestamp } = this.props;

    this.startSelectedTimer();
    this.startDeleteForEveryoneTimerIfApplicable();

    if (!prevProps.isSelected && isSelected) {
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
      window.CI?.handleEvent('message:send-complete', {
        timestamp,
        delta,
      });
      log.info(
        `Message.tsx: Rendered 'send complete' for message ${timestamp}; took ${delta}ms`
      );
    }
  }

  private getMetadataPlacement(
    {
      attachments,
      deletedForEveryone,
      direction,
      expirationLength,
      expirationTimestamp,
      giftBadge,
      i18n,
      shouldHideMetadata,
      status,
      text,
      textDirection,
    }: Readonly<Props> = this.props
  ): MetadataPlacement {
    const isRTL = textDirection === TextDirection.RightToLeft;

    if (
      !expirationLength &&
      !expirationTimestamp &&
      (!status || SENT_STATUSES.has(status)) &&
      shouldHideMetadata
    ) {
      return MetadataPlacement.NotRendered;
    }

    if (giftBadge) {
      const description = i18n(`message--giftBadge--unopened--${direction}`);
      const isDescriptionRTL = getDirection(description) === 'rtl';

      if (giftBadge.state === GiftBadgeStates.Unopened && !isDescriptionRTL) {
        return MetadataPlacement.InlineWithText;
      }

      return MetadataPlacement.Bottom;
    }

    if (!text && !deletedForEveryone) {
      return isAudio(attachments)
        ? MetadataPlacement.RenderedByMessageAudioComponent
        : MetadataPlacement.Bottom;
    }

    if (this.canRenderStickerLikeEmoji()) {
      return MetadataPlacement.Bottom;
    }

    if (isRTL) {
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
  private guessMetadataWidth(): number {
    const { direction, expirationLength, status } = this.props;

    let result = GUESS_METADATA_WIDTH_TIMESTAMP_SIZE;

    const hasExpireTimer = Boolean(expirationLength);
    if (hasExpireTimer) {
      result += GUESS_METADATA_WIDTH_EXPIRE_TIMER_SIZE;
    }

    if (direction === 'outgoing' && status) {
      result += GUESS_METADATA_WIDTH_OUTGOING_SIZE[status];
    }

    return result;
  }

  public startSelectedTimer(): void {
    const { clearSelectedMessage, interactionMode } = this.props;
    const { isSelected } = this.state;

    if (interactionMode === 'keyboard' || !isSelected) {
      return;
    }

    if (!this.selectedTimeout) {
      this.selectedTimeout = setTimeout(() => {
        this.selectedTimeout = undefined;
        this.setState({ isSelected: false });
        clearSelectedMessage();
      }, SELECTED_TIMEOUT);
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

  private getTimeRemainingForDeleteForEveryone(): number {
    const { timestamp } = this.props;
    return Math.max(timestamp - Date.now() + THREE_HOURS, 0);
  }

  private startDeleteForEveryoneTimerIfApplicable(): void {
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
    }, this.getTimeRemainingForDeleteForEveryone());
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

  private areLinksEnabled(): boolean {
    const { isMessageRequestAccepted, isBlocked } = this.props;
    return isMessageRequestAccepted && !isBlocked;
  }

  private shouldRenderAuthor(): boolean {
    const { author, conversationType, direction, shouldCollapseAbove } =
      this.props;
    return Boolean(
      direction === 'incoming' &&
        conversationType === 'group' &&
        author.title &&
        !shouldCollapseAbove
    );
  }

  private canRenderStickerLikeEmoji(): boolean {
    const { text, quote, storyReplyContext, attachments, previews } =
      this.props;

    return Boolean(
      text &&
        isEmojiOnlyText(text) &&
        getEmojiCount(text) < 6 &&
        !quote &&
        !storyReplyContext &&
        (!attachments || !attachments.length) &&
        (!previews || !previews.length)
    );
  }

  private updateMetadataWidth = (newMetadataWidth: number): void => {
    this.setState(({ metadataWidth }) => ({
      // We don't want text to jump around if the metadata shrinks, but we want to make
      //   sure we have enough room.
      metadataWidth: Math.max(metadataWidth, newMetadataWidth),
    }));
  };

  private renderMetadata(): ReactNode {
    let isInline: boolean;
    const metadataPlacement = this.getMetadataPlacement();
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
      deletedForEveryone,
      direction,
      expirationLength,
      expirationTimestamp,
      isSticker,
      isTapToViewExpired,
      status,
      i18n,
      text,
      textAttachment,
      timestamp,
      id,
      showMessageDetail,
    } = this.props;

    const isStickerLike = isSticker || this.canRenderStickerLikeEmoji();

    return (
      <MessageMetadata
        deletedForEveryone={deletedForEveryone}
        direction={direction}
        expirationLength={expirationLength}
        expirationTimestamp={expirationTimestamp}
        hasText={Boolean(text)}
        i18n={i18n}
        id={id}
        isInline={isInline}
        isShowingImage={this.isShowingImage()}
        isSticker={isStickerLike}
        isTapToViewExpired={isTapToViewExpired}
        onWidthMeasured={isInline ? this.updateMetadataWidth : undefined}
        showMessageDetail={showMessageDetail}
        status={status}
        textPending={textAttachment?.pending}
        timestamp={timestamp}
      />
    );
  }

  private renderAuthor(): ReactNode {
    const {
      author,
      contactNameColor,
      i18n,
      isSticker,
      isTapToView,
      isTapToViewExpired,
    } = this.props;

    if (!this.shouldRenderAuthor()) {
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
          title={author.isMe ? i18n('you') : author.title}
          module={moduleName}
        />
      </div>
    );
  }

  public renderAttachment(): JSX.Element | null {
    const {
      attachments,
      direction,
      expirationLength,
      expirationTimestamp,
      i18n,
      id,
      conversationId,
      isSticker,
      kickOffAttachmentDownload,
      markAttachmentAsCorrupted,
      quote,
      readStatus,
      reducedMotion,
      renderAudioAttachment,
      renderingContext,
      showMessageDetail,
      showLightbox,
      shouldCollapseAbove,
      shouldCollapseBelow,
      status,
      text,
      textAttachment,
      theme,
      timestamp,
    } = this.props;
    const { imageBroken } = this.state;

    const collapseMetadata =
      this.getMetadataPlacement() === MetadataPlacement.NotRendered;

    if (!attachments || !attachments[0]) {
      return null;
    }
    const firstAttachment = attachments[0];

    // For attachments which aren't full-frame
    const withContentBelow = Boolean(text);
    const withContentAbove = Boolean(quote) || this.shouldRenderAuthor();
    const displayImage = canDisplayImage(attachments);

    if (displayImage && !imageBroken) {
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
              theme={theme}
              i18n={i18n}
              tabIndex={0}
              reducedMotion={reducedMotion}
              onError={this.handleImageError}
              showVisualAttachment={() => {
                showLightbox({
                  attachment: firstAttachment,
                  messageId: id,
                });
              }}
              kickOffAttachmentDownload={() => {
                kickOffAttachmentDownload({
                  attachment: firstAttachment,
                  messageId: id,
                });
              }}
            />
          </div>
        );
      }

      if (
        isImage(attachments) ||
        (isVideo(attachments) &&
          (!isDownloaded(attachments[0]) ||
            !attachments?.[0].pending ||
            hasVideoScreenshot(attachments)))
      ) {
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
              onClick={attachment => {
                if (!isDownloaded(attachment)) {
                  kickOffAttachmentDownload({ attachment, messageId: id });
                } else {
                  showLightbox({ attachment, messageId: id });
                }
              }}
            />
          </div>
        );
      }
    }
    if (isAudio(attachments)) {
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
        showMessageDetail,
        status,
        textPending: textAttachment?.pending,
        timestamp,

        kickOffAttachmentDownload() {
          kickOffAttachmentDownload({
            attachment: firstAttachment,
            messageId: id,
          });
        },
        onCorrupted() {
          markAttachmentAsCorrupted({
            attachment: firstAttachment,
            messageId: id,
          });
        },
      });
    }
    const { pending, fileName, fileSize, contentType } = firstAttachment;
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
          !firstAttachment.url
            ? 'module-message__generic-attachment--not-active'
            : null
        )}
        // There's only ever one of these, so we don't want users to tab into it
        tabIndex={-1}
        onClick={event => {
          event.stopPropagation();
          event.preventDefault();

          if (!isDownloaded(firstAttachment)) {
            kickOffAttachmentDownload({
              attachment: firstAttachment,
              messageId: id,
            });
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
              `module-message__generic-attachment__file-name--${direction}`
            )}
          >
            {fileName}
          </div>
          <div
            className={classNames(
              'module-message__generic-attachment__file-size',
              `module-message__generic-attachment__file-size--${direction}`
            )}
          >
            {fileSize}
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
      openLink,
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

    const isClickable = this.areLinksEnabled();

    const className = classNames(
      'module-message__link-preview',
      `module-message__link-preview--${direction}`,
      {
        'module-message__link-preview--with-content-above': withContentAbove,
        'module-message__link-preview--nonclickable': !isClickable,
      }
    );
    const onPreviewImageClick = isClickable
      ? () => {
          if (first.image && !isDownloaded(first.image)) {
            kickOffAttachmentDownload({
              attachment: first.image,
              messageId: id,
            });
            return;
          }
          openLink(first.url);
        }
      : noop;
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
            onClick={onPreviewImageClick}
          />
        ) : null}
        <div className="module-message__link-preview__content">
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
                alt={i18n('previewThumbnail', [first.domain])}
                height={72}
                width={72}
                url={first.image.url}
                attachment={first.image}
                blurHash={first.image.blurHash}
                onError={this.handleImageError}
                i18n={i18n}
                onClick={onPreviewImageClick}
              />
            </div>
          ) : null}
          <div
            className={classNames(
              'module-message__link-preview__text',
              previewHasImage && !isFullSizeImage
                ? 'module-message__link-preview__text--with-icon'
                : null
            )}
          >
            <div className="module-message__link-preview__title">
              {first.title}
            </div>
            {first.description && (
              <div className="module-message__link-preview__description">
                {unescape(first.description)}
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

            openLink(first.url);
          }
        }}
        onClick={(event: React.MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();

          openLink(first.url);
        }}
      >
        {contents}
      </div>
    ) : (
      <div className={className}>{contents}</div>
    );
  }

  public renderGiftBadge(): JSX.Element | null {
    const { conversationTitle, direction, getPreferredBadge, giftBadge, i18n } =
      this.props;
    const { showOutgoingGiftBadgeModal } = this.state;
    if (!giftBadge) {
      return null;
    }

    if (giftBadge.state === GiftBadgeStates.Unopened) {
      const description = i18n(`message--giftBadge--unopened--${direction}`);
      const isRTL = getDirection(description) === 'rtl';
      const { metadataWidth } = this.state;

      return (
        <div className="module-message__unopened-gift-badge__container">
          <div
            className={classNames(
              'module-message__unopened-gift-badge',
              `module-message__unopened-gift-badge--${direction}`
            )}
            aria-label={i18n('message--giftBadge--unopened--label')}
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
              dir={isRTL ? 'rtl' : undefined}
            >
              {description}
              {this.getMetadataPlacement() ===
                MetadataPlacement.InlineWithText && (
                <MessageTextMetadataSpacer metadataWidth={metadataWidth} />
              )}
            </div>
            {this.renderMetadata()}
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
        remaining = i18n('message--giftBadge--remaining--days', {
          days: remainingDays,
        });
      } else if (remainingHours > 1) {
        remaining = i18n('message--giftBadge--remaining--hours', {
          hours: remainingHours,
        });
      } else if (remainingMinutes > 1) {
        remaining = i18n('message--giftBadge--remaining--minutes', {
          minutes: remainingMinutes,
        });
      } else if (remainingMinutes === 1) {
        remaining = i18n('message--giftBadge--remaining--one-minute');
      } else {
        remaining = i18n('message--giftBadge--expired');
      }

      const wasSent = direction === 'outgoing';
      const buttonContents = wasSent ? (
        i18n('message--giftBadge--view')
      ) : (
        <>
          <span
            className={classNames(
              'module-message__redeemed-gift-badge__icon-check',
              `module-message__redeemed-gift-badge__icon-check--${direction}`
            )}
          />{' '}
          {i18n('message--giftBadge--redeemed')}
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
          aria-label={i18n('giftBadge--missing')}
        />
      );

      return (
        <div className="module-message__redeemed-gift-badge__container">
          <div className="module-message__redeemed-gift-badge">
            {badgeElement}
            <div className="module-message__redeemed-gift-badge__text">
              <div className="module-message__redeemed-gift-badge__title">
                {i18n('message--giftBadge')}
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
          {this.renderMetadata()}
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
    if (payment == null || payment.kind !== PaymentEventKind.Notification) {
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
            <Emojify text={payment.note} />
          </p>
        )}
      </div>
    );
  }

  public renderQuote(): JSX.Element | null {
    const {
      conversationColor,
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
            {i18n('Quote__story-reaction', [storyReplyContext.authorTitle])}
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
      conversationId,
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
      this.getMetadataPlacement() !== MetadataPlacement.NotRendered;

    const otherContent =
      (contact && contact.firstNumber && contact.uuid) || withCaption;
    const tabIndex = otherContent ? 0 : -1;

    return (
      <EmbeddedContact
        contact={contact}
        isIncoming={direction === 'incoming'}
        i18n={i18n}
        onClick={() => {
          const signalAccount =
            contact.firstNumber && contact.uuid
              ? {
                  phoneNumber: contact.firstNumber,
                  uuid: contact.uuid,
                }
              : undefined;

          pushPanelForConversation(conversationId, {
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
    const { firstNumber, uuid } = contact;
    if (!firstNumber || !uuid) {
      return null;
    }

    return (
      <button
        type="button"
        onClick={e => {
          e.preventDefault();
          e.stopPropagation();
          startConversation(firstNumber, uuid);
        }}
        className={classNames(
          'module-message__send-message-button',
          noBottomLeftCurve &&
            'module-message__send-message-button--no-bottom-left-curve',
          noBottomRightCurve &&
            'module-message__send-message-button--no-bottom-right-curve'
        )}
      >
        {i18n('sendMessageToContact')}
      </button>
    );
  }

  private renderAvatar(): ReactNode {
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
            this.hasReactions(),
        })}
      >
        {shouldCollapseBelow ? (
          <AvatarSpacer size={GROUP_AVATAR_SIZE} />
        ) : (
          <Avatar
            acceptedMessageRequest={author.acceptedMessageRequest}
            avatarPath={author.avatarPath}
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
            unblurredAvatarPath={author.unblurredAvatarPath}
          />
        )}
      </div>
    );
  }

  public renderText(): JSX.Element | null {
    const {
      bodyRanges,
      deletedForEveryone,
      direction,
      displayLimit,
      i18n,
      id,
      kickOffAttachmentDownload,
      messageExpanded,
      showConversation,
      status,
      text,
      textAttachment,
      textDirection,
    } = this.props;
    const { metadataWidth } = this.state;
    const isRTL = textDirection === TextDirection.RightToLeft;

    // eslint-disable-next-line no-nested-ternary
    const contents = deletedForEveryone
      ? i18n('message--deletedForEveryone')
      : direction === 'incoming' && status === 'error'
      ? i18n('incomingError')
      : text;

    if (!contents) {
      return null;
    }

    return (
      <div
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
        dir={isRTL ? 'rtl' : undefined}
        onDoubleClick={(event: React.MouseEvent) => {
          // Prevent double-click interefering with interactions _inside_
          // the bubble.
          event.stopPropagation();
        }}
      >
        <MessageBodyReadMore
          bodyRanges={bodyRanges}
          direction={direction}
          disableLinks={!this.areLinksEnabled()}
          displayLimit={displayLimit}
          i18n={i18n}
          id={id}
          kickOffBodyDownload={() => {
            if (!textAttachment) {
              return;
            }
            kickOffAttachmentDownload({
              attachment: textAttachment,
              messageId: id,
            });
          }}
          messageExpanded={messageExpanded}
          showConversation={showConversation}
          text={contents || ''}
          textAttachment={textAttachment}
        />
        {!isRTL &&
          this.getMetadataPlacement() === MetadataPlacement.InlineWithText && (
            <MessageTextMetadataSpacer metadataWidth={metadataWidth} />
          )}
      </div>
    );
  }

  private renderError(): ReactNode {
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

    const incomingString = isTapToViewExpired
      ? i18n('Message--tap-to-view-expired')
      : i18n(
          `Message--tap-to-view--incoming${
            isVideo(attachments) ? '-video' : ''
          }`
        );
    const outgoingString = i18n('Message--tap-to-view--outgoing');
    const isDownloadPending = this.isAttachmentPending();

    if (isDownloadPending) {
      return;
    }

    // eslint-disable-next-line no-nested-ternary
    return isTapToViewError
      ? i18n('incomingError')
      : direction === 'outgoing'
      ? outgoingString
      : incomingString;
  }

  public renderTapToView(): JSX.Element {
    const {
      conversationType,
      direction,
      isTapToViewExpired,
      isTapToViewError,
    } = this.props;

    const collapseMetadata =
      this.getMetadataPlacement() === MetadataPlacement.NotRendered;
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

  private popperPreventOverflowModifier(): Partial<PreventOverflowModifier> {
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

    if (!this.hasReactions()) {
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
    const toRender = take(ordered, 3).map(res => ({
      emoji: res[0].emoji,
      count: res.length,
      isMe: res.some(re => Boolean(re.from.isMe)),
    }));
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
            >
              {toRender.map((re, i) => {
                const isLast = i === toRender.length - 1;
                const isMore = isLast && someNotRendered;
                const isMoreWithMe = isMore && notRenderedIsMe;

                return (
                  <button
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
              modifiers={[this.popperPreventOverflowModifier()]}
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
    const { giftBadge, isTapToView, deletedForEveryone } = this.props;

    if (deletedForEveryone) {
      return (
        <>
          {this.renderText()}
          {this.renderMetadata()}
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
          {this.renderMetadata()}
        </>
      );
    }

    return (
      <>
        {this.renderQuote()}
        {this.renderStoryReplyContext()}
        {this.renderAttachment()}
        {this.renderPreview()}
        {this.renderPayment()}
        {this.renderEmbeddedContact()}
        {this.renderText()}
        {this.renderMetadata()}
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
      conversationId,
      showLightboxForViewOnceMedia,
      direction,
      giftBadge,
      id,
      isTapToView,
      isTapToViewExpired,
      kickOffAttachmentDownload,
      startConversation,
      openGiftBadge,
      pushPanelForConversation,
      showLightbox,
      showExpiredIncomingTapToViewToast,
      showExpiredOutgoingTapToViewToast,
    } = this.props;
    const { imageBroken } = this.state;

    const isAttachmentPending = this.isAttachmentPending();

    if (giftBadge && giftBadge.state === GiftBadgeStates.Unopened) {
      openGiftBadge(id);
      return;
    }

    if (isTapToView) {
      if (isAttachmentPending) {
        log.info(
          '<Message> handleOpen: tap-to-view attachment is pending; not showing the lightbox'
        );
        return;
      }

      if (attachments && !isDownloaded(attachments[0])) {
        event.preventDefault();
        event.stopPropagation();
        kickOffAttachmentDownload({
          attachment: attachments[0],
          messageId: id,
        });
        return;
      }

      if (isTapToViewExpired) {
        const action =
          direction === 'outgoing'
            ? showExpiredOutgoingTapToViewToast
            : showExpiredIncomingTapToViewToast;
        action();
      } else {
        event.preventDefault();
        event.stopPropagation();

        showLightboxForViewOnceMedia(id);
      }

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

      const attachment = attachments[0];

      kickOffAttachmentDownload({ attachment, messageId: id });

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

    if (contact && contact.firstNumber && contact.uuid) {
      startConversation(contact.firstNumber, contact.uuid);

      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (contact) {
      const signalAccount =
        contact.firstNumber && contact.uuid
          ? {
              phoneNumber: contact.firstNumber,
              uuid: contact.uuid,
            }
          : undefined;
      pushPanelForConversation(conversationId, {
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
      kickOffAttachmentDownload({
        attachment,
        messageId: id,
      });
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
      conversationColor,
      customColor,
      deletedForEveryone,
      direction,
      giftBadge,
      isSticker,
      isTapToView,
      isTapToViewExpired,
      isTapToViewError,
      onContextMenu,
      onKeyDown,
      text,
    } = this.props;
    const { isSelected } = this.state;

    const isAttachmentPending = this.isAttachmentPending();

    const width = this.getWidth();
    const shouldUseWidth = Boolean(giftBadge || this.isShowingImage());

    const isEmojiOnly = this.canRenderStickerLikeEmoji();
    const isStickerLike = isSticker || isEmojiOnly;

    // If it's a mostly-normal gray incoming text box, we don't want to darken it as much
    const lighterSelect =
      isSelected &&
      direction === 'incoming' &&
      !isStickerLike &&
      (text || (!isVideo(attachments) && !isImage(attachments)));

    const containerClassnames = classNames(
      'module-message__container',
      isGIF(attachments) ? 'module-message__container--gif' : null,
      isSelected ? 'module-message__container--selected' : null,
      lighterSelect ? 'module-message__container--selected-lighter' : null,
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
      this.hasReactions() ? 'module-message__container--with-reactions' : null,
      deletedForEveryone
        ? 'module-message__container--deleted-for-everyone'
        : null
    );
    const containerStyles = {
      width: shouldUseWidth ? width : undefined,
    };
    if (!isStickerLike && !deletedForEveryone && direction === 'outgoing') {
      Object.assign(containerStyles, getCustomColorStyle(customColor));
    }

    return (
      <div className="module-message__container-outer">
        <div
          className={containerClassnames}
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
          {this.renderAuthor()}
          {this.renderContents()}
        </div>
        {this.renderReactions(direction === 'outgoing')}
      </div>
    );
  }

  public override render(): JSX.Element | null {
    const {
      attachments,
      direction,
      isSticker,
      shouldCollapseAbove,
      shouldCollapseBelow,
      menu,
      onKeyDown,
    } = this.props;
    const { expired, expiring, isSelected, imageBroken } = this.state;

    if (expired) {
      return null;
    }

    if (isSticker && (imageBroken || !attachments || !attachments.length)) {
      return null;
    }

    return (
      <div
        className={classNames(
          'module-message',
          `module-message--${direction}`,
          shouldCollapseAbove && 'module-message--collapsed-above',
          shouldCollapseBelow && 'module-message--collapsed-below',
          isSelected ? 'module-message--selected' : null,
          expiring ? 'module-message--expired' : null
        )}
        tabIndex={0}
        // We need to have a role because screenreaders need to be able to focus here to
        //   read the message, but we can't be a button; that would break inner buttons.
        role="row"
        onKeyDown={onKeyDown}
        onFocus={this.handleFocus}
        ref={this.focusRef}
      >
        {this.renderError()}
        {this.renderAvatar()}
        {this.renderContainer()}
        {menu}
      </div>
    );
  }
}
