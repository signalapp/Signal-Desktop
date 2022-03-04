// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FuseOptions } from 'fuse.js';
import Fuse from 'fuse.js';
import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import type { ConversationStoryType, StoryViewType } from './StoryListItem';
import type { LocalizerType } from '../types/Util';
import { SearchInput } from './SearchInput';
import { StoryListItem } from './StoryListItem';

const FUSE_OPTIONS: FuseOptions<ConversationStoryType> = {
  getFn: (obj, path) => {
    if (path === 'searchNames') {
      return obj.stories.flatMap((story: StoryViewType) => [
        story.sender.title,
        story.sender.name,
      ]);
    }

    return obj.group?.title;
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
  tokenize: true,
};

function search(
  stories: ReadonlyArray<ConversationStoryType>,
  searchTerm: string
): Array<ConversationStoryType> {
  return new Fuse<ConversationStoryType>(stories, FUSE_OPTIONS).search(
    searchTerm
  );
}

export type PropsType = {
  hiddenStories: Array<ConversationStoryType>;
  i18n: LocalizerType;
  onBack: () => unknown;
  onStoryClicked: (conversationId: string) => unknown;
  openConversationInternal: (_: { conversationId: string }) => unknown;
  stories: Array<ConversationStoryType>;
  toggleHideStories: (conversationId: string) => unknown;
};

export const StoriesPane = ({
  i18n,
  onBack,
  onStoryClicked,
  openConversationInternal,
  stories,
  toggleHideStories,
}: PropsType): JSX.Element => {
  const [searchTerm, setSearchTerm] = useState('');
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
            key={story.stories[0].timestamp}
            i18n={i18n}
            onClick={() => {
              onStoryClicked(story.conversationId);
            }}
            onHideStory={() => {
              toggleHideStories(story.stories[0].sender.id);
            }}
            onGoToConversation={conversationId => {
              openConversationInternal({ conversationId });
            }}
            story={story.stories[0]}
          />
        ))}
        {!stories.length && i18n('Stories__list-empty')}
      </div>
    </>
  );
};
