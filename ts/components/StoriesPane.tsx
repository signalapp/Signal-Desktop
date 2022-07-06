// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Fuse from 'fuse.js';
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import type {
  ConversationType,
  ShowConversationType,
} from '../state/ducks/conversations';
import type {
  ConversationStoryType,
  MyStoryType,
  StoryViewType,
} from '../types/Stories';
import type { LocalizerType } from '../types/Util';
import { MyStoriesButton } from './MyStoriesButton';
import { SearchInput } from './SearchInput';
import { StoryListItem } from './StoryListItem';
import { isNotNil } from '../util/isNotNil';

const FUSE_OPTIONS: Fuse.IFuseOptions<ConversationStoryType> = {
  getFn: (story, path) => {
    if (path === 'searchNames') {
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

function getNewestMyStory(story: MyStoryType): StoryViewType {
  return story.stories[story.stories.length - 1];
}

export type PropsType = {
  hiddenStories: Array<ConversationStoryType>;
  i18n: LocalizerType;
  me: ConversationType;
  myStories: Array<MyStoryType>;
  onAddStory: () => unknown;
  onMyStoriesClicked: () => unknown;
  onStoryClicked: (conversationId: string) => unknown;
  queueStoryDownload: (storyId: string) => unknown;
  showConversation: ShowConversationType;
  stories: Array<ConversationStoryType>;
  toggleHideStories: (conversationId: string) => unknown;
  toggleStoriesView: () => unknown;
};

export const StoriesPane = ({
  hiddenStories,
  i18n,
  me,
  myStories,
  onAddStory,
  onMyStoriesClicked,
  onStoryClicked,
  queueStoryDownload,
  showConversation,
  stories,
  toggleHideStories,
  toggleStoriesView,
}: PropsType): JSX.Element => {
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

  return (
    <>
      <div className="Stories__pane__header">
        <button
          aria-label={i18n('back')}
          className="Stories__pane__header--back"
          onClick={toggleStoriesView}
          tabIndex={0}
          type="button"
        />
        <div className="Stories__pane__header--title">
          {i18n('Stories__title')}
        </div>
        <button
          aria-label={i18n('Stories__add')}
          className="Stories__pane__header--camera"
          onClick={onAddStory}
          type="button"
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
      <MyStoriesButton
        hasMultiple={myStories.length ? myStories[0].stories.length > 1 : false}
        i18n={i18n}
        me={me}
        newestStory={
          myStories.length ? getNewestMyStory(myStories[0]) : undefined
        }
        onClick={onMyStoriesClicked}
        queueStoryDownload={queueStoryDownload}
      />
      <div
        className={classNames('Stories__pane__list', {
          'Stories__pane__list--empty': !stories.length,
        })}
      >
        {renderedStories.map(story => (
          <StoryListItem
            group={story.group}
            i18n={i18n}
            key={story.storyView.timestamp}
            onClick={() => {
              onStoryClicked(story.conversationId);
            }}
            onHideStory={toggleHideStories}
            onGoToConversation={conversationId => {
              showConversation({ conversationId });
              toggleStoriesView();
            }}
            queueStoryDownload={queueStoryDownload}
            story={story.storyView}
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
                  key={story.storyView.timestamp}
                  i18n={i18n}
                  isHidden
                  onClick={() => {
                    onStoryClicked(story.conversationId);
                  }}
                  onHideStory={toggleHideStories}
                  onGoToConversation={conversationId => {
                    showConversation({ conversationId });
                    toggleStoriesView();
                  }}
                  queueStoryDownload={queueStoryDownload}
                  story={story.storyView}
                />
              ))}
          </>
        )}
        {!stories.length && i18n('Stories__list-empty')}
      </div>
    </>
  );
};
