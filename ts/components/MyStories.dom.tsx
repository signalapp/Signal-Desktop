// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';
import type { MyStoryType, StoryViewType } from '../types/Stories.std.ts';
import {
  ResolvedSendStatus,
  StoryViewTargetType,
  StoryViewModeType,
} from '../types/Stories.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import type { ViewStoryActionCreatorType } from '../state/ducks/stories.preload.ts';
import { MessageTimestamp } from './conversation/MessageTimestamp.dom.tsx';
import { StoryDistributionListName } from './StoryDistributionListName.dom.tsx';
import { StoryImage } from './StoryImage.dom.tsx';
import { resolveStorySendStatus } from '../util/resolveStorySendStatus.std.ts';
import { useRetryStorySend } from '../hooks/useRetryStorySend.dom.tsx';
import { NavSidebar } from './NavSidebar.dom.tsx';
import type { WidthBreakpoint } from './_util.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import { AxoDropdownMenu } from '../axo/AxoDropdownMenu.dom.tsx';
import { AxoIconButton } from '../axo/AxoIconButton.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';

export type PropsType = {
  i18n: LocalizerType;
  otherTabsUnreadCount: number;
  hasFailedStorySends: boolean;
  hasPendingUpdate: boolean;
  navTabsCollapsed: boolean;
  myStories: Array<MyStoryType>;
  onBack: () => unknown;
  onDelete: (story: StoryViewType) => unknown;
  onForward: (storyId: string) => unknown;
  onSave: (story: StoryViewType) => unknown;
  onMediaPlaybackStart: () => void;
  onToggleNavTabsCollapse: (navTabsCollapsed: boolean) => void;
  queueStoryDownload: (storyId: string) => unknown;
  retryMessageSend: (messageId: string) => unknown;
  viewStory: ViewStoryActionCreatorType;
  hasViewReceiptSetting: boolean;
  preferredLeftPaneWidth: number;
  renderToastManager: (_: {
    containerWidthBreakpoint: WidthBreakpoint;
  }) => JSX.Element;
  savePreferredLeftPaneWidth: (preferredLeftPaneWidth: number) => void;
};

export function MyStories({
  i18n,
  otherTabsUnreadCount,
  hasFailedStorySends,
  hasPendingUpdate,
  navTabsCollapsed,
  myStories,
  onBack,
  onDelete,
  onForward,
  onSave,
  queueStoryDownload,
  retryMessageSend,
  viewStory,
  hasViewReceiptSetting,
  onMediaPlaybackStart,
  onToggleNavTabsCollapse,
  preferredLeftPaneWidth,
  renderToastManager,
  savePreferredLeftPaneWidth,
}: PropsType): JSX.Element {
  const [confirmDeleteStory, setConfirmDeleteStory] = useState<
    StoryViewType | undefined
  >();

  return (
    <>
      <AxoConfirmDialog.Root
        open={confirmDeleteStory != null}
        onOpenChange={() => setConfirmDeleteStory(undefined)}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:MyStories__delete')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={() => {
            strictAssert(
              confirmDeleteStory != null,
              'Missing confirmDeleteStory'
            );
            onDelete(confirmDeleteStory);
          }}
        >
          {i18n('icu:delete')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
      <NavSidebar
        i18n={i18n}
        title={i18n('icu:MyStories__title')}
        otherTabsUnreadCount={otherTabsUnreadCount}
        hasFailedStorySends={hasFailedStorySends}
        hasPendingUpdate={hasPendingUpdate}
        navTabsCollapsed={navTabsCollapsed}
        onBack={onBack}
        onToggleNavTabsCollapse={onToggleNavTabsCollapse}
        preferredLeftPaneWidth={preferredLeftPaneWidth}
        requiresFullWidth
        renderToastManager={renderToastManager}
        savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
      >
        <div className="Stories__pane__list">
          {myStories.map(list => (
            <div key={list.id}>
              <div className="MyStories__distribution__title">
                <StoryDistributionListName
                  i18n={i18n}
                  id={list.id}
                  name={list.name}
                />
              </div>
              {list.stories.map(story => (
                <StorySent
                  hasViewReceiptSetting={hasViewReceiptSetting}
                  i18n={i18n}
                  key={story.messageId}
                  onForward={onForward}
                  onSave={onSave}
                  onMediaPlaybackStart={onMediaPlaybackStart}
                  queueStoryDownload={queueStoryDownload}
                  retryMessageSend={retryMessageSend}
                  setConfirmDeleteStory={setConfirmDeleteStory}
                  story={story}
                  viewStory={viewStory}
                />
              ))}
            </div>
          ))}
        </div>
        {!myStories.length && (
          <div className="Stories__pane__list--empty">
            {i18n('icu:Stories__list-empty')}
          </div>
        )}
      </NavSidebar>
    </>
  );
}

type StorySentPropsType = Pick<
  PropsType,
  | 'hasViewReceiptSetting'
  | 'i18n'
  | 'onForward'
  | 'onSave'
  | 'queueStoryDownload'
  | 'retryMessageSend'
  | 'viewStory'
  | 'onMediaPlaybackStart'
> & {
  setConfirmDeleteStory: (_: StoryViewType | undefined) => unknown;
  story: StoryViewType;
};

function StorySent({
  hasViewReceiptSetting,
  i18n,
  onForward,
  onSave,
  onMediaPlaybackStart,
  queueStoryDownload,
  retryMessageSend,
  setConfirmDeleteStory,
  story,
  viewStory,
}: StorySentPropsType): JSX.Element {
  const sendStatus = resolveStorySendStatus(story.sendState ?? []);
  const { renderAlert, setWasManuallyRetried, wasManuallyRetried } =
    useRetryStorySend(i18n, sendStatus);

  return (
    <div className="MyStories__story" key={story.timestamp}>
      {renderAlert()}
      <button
        aria-label={i18n('icu:MyStories__story')}
        className="StoryListItem__button MyStories__story-button"
        onClick={() => {
          if (
            !wasManuallyRetried &&
            (sendStatus === ResolvedSendStatus.Failed ||
              sendStatus === ResolvedSendStatus.PartiallySent)
          ) {
            setWasManuallyRetried(true);
            retryMessageSend(story.messageId);
            return;
          }

          viewStory({
            storyId: story.messageId,
            storyViewMode: StoryViewModeType.MyStories,
          });
        }}
        type="button"
      >
        <div className="StoryListItem__previews">
          <StoryImage
            attachment={story.attachment}
            firstName={i18n('icu:you')}
            i18n={i18n}
            isMe
            isThumbnail
            label={i18n('icu:MyStories__story')}
            className="StoryListItem__previews--image"
            queueStoryDownload={queueStoryDownload}
            storyId={story.messageId}
            onMediaPlaybackStart={onMediaPlaybackStart}
          />
        </div>
        <div className="MyStories__story__details">
          {sendStatus === ResolvedSendStatus.Sending &&
            i18n('icu:Stories__list--sending')}
          {sendStatus === ResolvedSendStatus.Failed && (
            <div className="MyStories__story__details__failed">
              <div>
                {i18n('icu:Stories__list--send_failed')}
                {!wasManuallyRetried && (
                  <div className="MyStories__story__details__failed__button">
                    {i18n('icu:Stories__list--retry-send')}
                  </div>
                )}
              </div>
            </div>
          )}
          {sendStatus === ResolvedSendStatus.PartiallySent && (
            <div className="MyStories__story__details__failed">
              <div>
                {i18n('icu:Stories__list--partially-sent')}
                {!wasManuallyRetried && (
                  <div className="MyStories__story__details__failed__button">
                    {i18n('icu:Stories__list--retry-send')}
                  </div>
                )}
              </div>
            </div>
          )}
          {sendStatus === ResolvedSendStatus.Sent && (
            <>
              {hasViewReceiptSetting
                ? i18n('icu:MyStories__views', {
                    views: story.views ?? 0,
                  })
                : i18n('icu:MyStories__views-off')}
              <MessageTimestamp
                i18n={i18n}
                isRelativeTime
                className="MyStories__story__timestamp"
                timestamp={story.timestamp}
              />
            </>
          )}
        </div>
      </button>
      {story.attachment && story.attachment.path && (
        <button
          aria-label={i18n('icu:MyStories__download')}
          className="MyStories__story__download"
          onClick={() => {
            onSave(story);
          }}
          type="button"
        />
      )}
      <div className="MyStories__story__more">
        <AxoDropdownMenu.Root>
          <AxoDropdownMenu.Trigger>
            <AxoIconButton.Root
              variant="strong-secondary"
              size="sm"
              symbol="more"
              label={i18n('icu:MyStories__more')}
            />
          </AxoDropdownMenu.Trigger>
          <AxoDropdownMenu.Content>
            <AxoDropdownMenu.Item
              symbol="forward"
              onSelect={() => onForward(story.messageId)}
            >
              {i18n('icu:forward')}
            </AxoDropdownMenu.Item>
            <AxoDropdownMenu.Item
              symbol="info"
              onSelect={() => {
                viewStory({
                  storyId: story.messageId,
                  storyViewMode: StoryViewModeType.MyStories,
                  viewTarget: StoryViewTargetType.Details,
                });
              }}
            >
              {i18n('icu:StoryListItem__info')}
            </AxoDropdownMenu.Item>
            <AxoDropdownMenu.Item
              symbol="trash"
              onSelect={() => setConfirmDeleteStory(story)}
            >
              {i18n('icu:delete')}
            </AxoDropdownMenu.Item>
          </AxoDropdownMenu.Content>
        </AxoDropdownMenu.Root>
      </div>
    </div>
  );
}
