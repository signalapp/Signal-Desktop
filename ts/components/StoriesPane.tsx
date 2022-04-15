// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Fuse from 'fuse.js';
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { isNotNil } from '../util/isNotNil';
import type { ConversationStoryType, StoryViewType } from './StoryListItem';
import type { LocalizerType } from '../types/Util';
import { SearchInput } from './SearchInput';
import { StoryListItem } from './StoryListItem';

const FUSE_OPTIONS: Fuse.IFuseOptions<ConversationStoryType> = {
  getFn: (obj, path) => {
    if (path === 'searchNames') {
      return obj.stories
        .flatMap((story: StoryViewType) => [
          story.sender.title,
          story.sender.name,
        ])
        .filter(isNotNil);
    }

    return obj.group?.title ?? '';
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

function getNewestStory(story: ConversationStoryType): StoryViewType {
  return story.stories[story.stories.length - 1];
}

export type PropsType = {
  hiddenStories: Array<ConversationStoryType>;
  i18n: LocalizerType;
  onBack: () => unknown;
  onStoryClicked: (conversationId: string) => unknown;
  openConversationInternal: (_: { conversationId: string }) => unknown;
  queueStoryDownload: (storyId: string) => unknown;
  stories: Array<ConversationStoryType>;
  toggleHideStories: (conversationId: string) => unknown;
};

export const StoriesPane = ({
  hiddenStories,
  i18n,
  onBack,
  onStoryClicked,
  openConversationInternal,
  queueStoryDownload,
  stories,
  toggleHideStories,
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
          onClick={onBack}
          tabIndex={0}
          type="button"
        />
        <div className="Stories__pane__header--title">
          {i18n('Stories__title')}
        </div>
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
      <div
        className={classNames('Stories__pane__list', {
          'Stories__pane__list--empty': !stories.length,
        })}
      >
        {renderedStories.map(story => (
          <StoryListItem
            group={story.group}
            i18n={i18n}
            key={getNewestStory(story).timestamp}
            onClick={() => {
              onStoryClicked(story.conversationId);
            }}
            onHideStory={() => {
              toggleHideStories(getNewestStory(story).sender.id);
            }}
            onGoToConversation={conversationId => {
              openConversationInternal({ conversationId });
            }}
            queueStoryDownload={queueStoryDownload}
            story={getNewestStory(story)}
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
                  key={getNewestStory(story).timestamp}
                  i18n={i18n}
                  isHidden
                  onClick={() => {
                    onStoryClicked(story.conversationId);
                  }}
                  onHideStory={() => {
                    toggleHideStories(getNewestStory(story).sender.id);
                  }}
                  onGoToConversation={conversationId => {
                    openConversationInternal({ conversationId });
                  }}
                  queueStoryDownload={queueStoryDownload}
                  story={getNewestStory(story)}
                />
              ))}
          </>
        )}
        {!stories.length && i18n('Stories__list-empty')}
      </div>
    </>
  );
};
