// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import type { MyStoryType, StoryViewType } from '../types/Stories';
import {
  ResolvedSendStatus,
  StoryViewTargetType,
  StoryViewModeType,
} from '../types/Stories';
import type { LocalizerType } from '../types/Util';
import { ThemeType } from '../types/Util';
import type { ViewStoryActionCreatorType } from '../state/ducks/stories';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenu } from './ContextMenu';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { StoryDistributionListName } from './StoryDistributionListName';
import { StoryImage } from './StoryImage';
import { Theme } from '../util/theme';
import { resolveStorySendStatus } from '../util/resolveStorySendStatus';
import { useRetryStorySend } from '../hooks/useRetryStorySend';
import { NavSidebar } from './NavSidebar';
import type { WidthBreakpoint } from './_util';
import type { UnreadStats } from '../util/countUnreadStats';

export type PropsType = {
  i18n: LocalizerType;
  otherTabsUnreadStats: UnreadStats;
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
  theme: ThemeType;
};

export function MyStories({
  i18n,
  otherTabsUnreadStats,
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
  theme,
}: PropsType): JSX.Element {
  const [confirmDeleteStory, setConfirmDeleteStory] = useState<
    StoryViewType | undefined
  >();

  return (
    <>
      {confirmDeleteStory && (
        <ConfirmationDialog
          dialogName="MyStories.delete"
          actions={[
            {
              text: i18n('icu:delete'),
              action: () => onDelete(confirmDeleteStory),
              style: 'negative',
            },
          ]}
          i18n={i18n}
          onClose={() => setConfirmDeleteStory(undefined)}
        >
          {i18n('icu:MyStories__delete')}
        </ConfirmationDialog>
      )}
      <NavSidebar
        i18n={i18n}
        title={i18n('icu:MyStories__title')}
        otherTabsUnreadStats={otherTabsUnreadStats}
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
            <div className="MyStories__distribution" key={list.id}>
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
                  theme={theme}
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
  | 'theme'
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
  theme,
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
            moduleClassName="StoryListItem__previews--image"
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
                module="MyStories__story__timestamp"
                timestamp={story.timestamp}
              />
            </>
          )}
        </div>
      </button>
      {story.attachment && (story.attachment.path || story.attachment.data) && (
        <button
          aria-label={i18n('icu:MyStories__download')}
          className="MyStories__story__download"
          onClick={() => {
            onSave(story);
          }}
          type="button"
        />
      )}
      <ContextMenu
        i18n={i18n}
        menuOptions={[
          {
            icon: 'MyStories__icon--forward',
            label: i18n('icu:forward'),
            onClick: () => {
              onForward(story.messageId);
            },
          },
          {
            icon: 'StoryListItem__icon--info',
            label: i18n('icu:StoryListItem__info'),
            onClick: () => {
              viewStory({
                storyId: story.messageId,
                storyViewMode: StoryViewModeType.MyStories,
                viewTarget: StoryViewTargetType.Details,
              });
            },
          },
          {
            icon: 'MyStories__icon--delete',
            label: i18n('icu:delete'),
            onClick: () => {
              setConfirmDeleteStory(story);
            },
          },
        ]}
        moduleClassName="MyStories__story__more"
        theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
      />
    </div>
  );
}
