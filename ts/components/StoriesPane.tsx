// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Fuse from 'fuse.js';
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import type {
  ConversationType,
  ShowConversationType,
} from '../state/ducks/conversations';
import type { ConversationStoryType, MyStoryType } from '../types/Stories';
import type { LocalizerType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { ShowToastActionCreatorType } from '../state/ducks/toast';
import type { ViewUserStoriesActionCreatorType } from '../state/ducks/stories';
import { ContextMenu } from './ContextMenu';
import { MyStoryButton } from './MyStoryButton';
import { SearchInput } from './SearchInput';
import { StoriesAddStoryButton } from './StoriesAddStoryButton';
import { StoryListItem } from './StoryListItem';
import { Theme } from '../util/theme';
import { isNotNil } from '../util/isNotNil';
import { useRestoreFocus } from '../hooks/useRestoreFocus';

const FUSE_OPTIONS: Fuse.IFuseOptions<ConversationStoryType> = {
  getFn: (story, path) => {
    if (path[0] === 'searchNames' || path === 'searchNames') {
      return [story.storyView.sender.title, story.storyView.sender.name].filter(
        isNotNil
      );
    }

    return story.group?.title ?? '';
  },
  keys: [
    {
      name: 'searchNames',
      weight: 1,
    },
    {
      name: 'group',
      weight: 1,
    },
  ],
  threshold: 0.1,
};

function search(
  stories: ReadonlyArray<ConversationStoryType>,
  searchTerm: string
): Array<ConversationStoryType> {
  return new Fuse<ConversationStoryType>(stories, FUSE_OPTIONS)
    .search(searchTerm)
    .map(result => result.item);
}

export type PropsType = {
  getPreferredBadge: PreferredBadgeSelectorType;
  hiddenStories: Array<ConversationStoryType>;
  i18n: LocalizerType;
  maxAttachmentSizeInKb: number;
  me: ConversationType;
  myStories: Array<MyStoryType>;
  onAddStory: (file?: File) => unknown;
  onMyStoriesClicked: () => unknown;
  onStoriesSettings: () => unknown;
  onMediaPlaybackStart: () => void;
  queueStoryDownload: (storyId: string) => unknown;
  showConversation: ShowConversationType;
  showToast: ShowToastActionCreatorType;
  stories: Array<ConversationStoryType>;
  toggleHideStories: (conversationId: string) => unknown;
  toggleStoriesView: () => unknown;
  viewUserStories: ViewUserStoriesActionCreatorType;
};

export function StoriesPane({
  getPreferredBadge,
  hiddenStories,
  i18n,
  maxAttachmentSizeInKb,
  me,
  myStories,
  onAddStory,
  onMyStoriesClicked,
  onStoriesSettings,
  onMediaPlaybackStart,
  queueStoryDownload,
  showConversation,
  showToast,
  stories,
  toggleHideStories,
  toggleStoriesView,
  viewUserStories,
}: PropsType): JSX.Element {
  const [searchTerm, setSearchTerm] = useState('');
  const [isShowingHiddenStories, setIsShowingHiddenStories] = useState(false);
  const [renderedStories, setRenderedStories] =
    useState<Array<ConversationStoryType>>(stories);

  useEffect(() => {
    if (searchTerm) {
      setRenderedStories(search(stories, searchTerm));
    } else {
      setRenderedStories(stories);
    }
  }, [searchTerm, stories]);

  const [focusRef] = useRestoreFocus();

  return (
    <>
      <div className="Stories__pane__header">
        <button
          ref={focusRef}
          aria-label={i18n('back')}
          className="Stories__pane__header--back"
          onClick={toggleStoriesView}
          tabIndex={0}
          type="button"
        />
        <div className="Stories__pane__header--title">
          {i18n('Stories__title')}
        </div>
        <StoriesAddStoryButton
          i18n={i18n}
          maxAttachmentSizeInKb={maxAttachmentSizeInKb}
          moduleClassName="Stories__pane__add-story"
          onAddStory={onAddStory}
          showToast={showToast}
        />
        <ContextMenu
          i18n={i18n}
          menuOptions={[
            {
              label: i18n('StoriesSettings__context-menu'),
              onClick: () => onStoriesSettings(),
            },
          ]}
          moduleClassName="Stories__pane__settings"
          popperOptions={{
            placement: 'bottom',
            strategy: 'absolute',
          }}
          theme={Theme.Dark}
        />
      </div>
      <SearchInput
        i18n={i18n}
        moduleClassName="Stories__search"
        onChange={event => {
          setSearchTerm(event.target.value);
        }}
        placeholder={i18n('search')}
        value={searchTerm}
      />
      <div className="Stories__pane__list">
        <MyStoryButton
          i18n={i18n}
          maxAttachmentSizeInKb={maxAttachmentSizeInKb}
          me={me}
          myStories={myStories}
          onAddStory={onAddStory}
          onClick={onMyStoriesClicked}
          queueStoryDownload={queueStoryDownload}
          showToast={showToast}
          onMediaPlaybackStart={onMediaPlaybackStart}
        />
        {renderedStories.map(story => (
          <StoryListItem
            conversationId={story.conversationId}
            getPreferredBadge={getPreferredBadge}
            hasReplies={story.hasReplies}
            hasRepliesFromSelf={story.hasRepliesFromSelf}
            group={story.group}
            i18n={i18n}
            key={story.storyView.timestamp}
            onGoToConversation={conversationId => {
              showConversation({ conversationId });
              toggleStoriesView();
            }}
            onHideStory={toggleHideStories}
            onMediaPlaybackStart={onMediaPlaybackStart}
            queueStoryDownload={queueStoryDownload}
            story={story.storyView}
            viewUserStories={viewUserStories}
          />
        ))}
        {Boolean(hiddenStories.length) && (
          <>
            <button
              className={classNames('Stories__hidden-stories', {
                'Stories__hidden-stories--expanded': isShowingHiddenStories,
              })}
              onClick={() => setIsShowingHiddenStories(!isShowingHiddenStories)}
              type="button"
            >
              {i18n('Stories__hidden-stories')}
            </button>
            {isShowingHiddenStories &&
              hiddenStories.map(story => (
                <StoryListItem
                  conversationId={story.conversationId}
                  getPreferredBadge={getPreferredBadge}
                  group={story.group}
                  i18n={i18n}
                  isHidden
                  key={story.storyView.timestamp}
                  onGoToConversation={conversationId => {
                    showConversation({ conversationId });
                    toggleStoriesView();
                  }}
                  onHideStory={toggleHideStories}
                  onMediaPlaybackStart={onMediaPlaybackStart}
                  queueStoryDownload={queueStoryDownload}
                  story={story.storyView}
                  viewUserStories={viewUserStories}
                />
              ))}
          </>
        )}
        {!stories.length && (
          <div className="Stories__pane__list--empty">
            {i18n('Stories__list-empty')}
          </div>
        )}
      </div>
    </>
  );
}
