// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import type { MyStoryType, StoryViewType } from '../types/Stories';
import type { LocalizerType } from '../types/Util';
import type { ViewStoryActionCreatorType } from '../state/ducks/stories';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenu } from './ContextMenu';
import { StoryViewModeType } from '../types/Stories';
import { MessageTimestamp } from './conversation/MessageTimestamp';
import { StoryDistributionListName } from './StoryDistributionListName';
import { StoryImage } from './StoryImage';
import { Theme } from '../util/theme';

export type PropsType = {
  i18n: LocalizerType;
  myStories: Array<MyStoryType>;
  onBack: () => unknown;
  onDelete: (story: StoryViewType) => unknown;
  onForward: (storyId: string) => unknown;
  onSave: (story: StoryViewType) => unknown;
  queueStoryDownload: (storyId: string) => unknown;
  viewStory: ViewStoryActionCreatorType;
};

export const MyStories = ({
  i18n,
  myStories,
  onBack,
  onDelete,
  onForward,
  onSave,
  queueStoryDownload,
  viewStory,
}: PropsType): JSX.Element => {
  const [confirmDeleteStory, setConfirmDeleteStory] = useState<
    StoryViewType | undefined
  >();

  return (
    <>
      {confirmDeleteStory && (
        <ConfirmationDialog
          actions={[
            {
              text: i18n('delete'),
              action: () => onDelete(confirmDeleteStory),
              style: 'negative',
            },
          ]}
          i18n={i18n}
          onClose={() => setConfirmDeleteStory(undefined)}
        >
          {i18n('MyStories__delete')}
        </ConfirmationDialog>
      )}
      <div className="Stories__pane__header Stories__pane__header--centered">
        <button
          aria-label={i18n('back')}
          className="Stories__pane__header--back"
          onClick={onBack}
          type="button"
        />
        <div className="Stories__pane__header--title">
          {i18n('MyStories__title')}
        </div>
      </div>
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
              <div className="MyStories__story" key={story.timestamp}>
                {story.attachment && (
                  <button
                    aria-label={i18n('MyStories__story')}
                    className="MyStories__story__preview"
                    onClick={() =>
                      viewStory({
                        storyId: story.messageId,
                        storyViewMode: StoryViewModeType.Single,
                      })
                    }
                    type="button"
                  >
                    <StoryImage
                      attachment={story.attachment}
                      firstName={i18n('you')}
                      i18n={i18n}
                      isMe
                      isThumbnail
                      label={i18n('MyStories__story')}
                      moduleClassName="MyStories__story__preview"
                      queueStoryDownload={queueStoryDownload}
                      storyId={story.messageId}
                    />
                  </button>
                )}
                <div className="MyStories__story__details">
                  {story.views === 1
                    ? i18n('MyStories__views--singular', [String(story.views)])
                    : i18n('MyStories__views--plural', [
                        String(story.views || 0),
                      ])}
                  <MessageTimestamp
                    i18n={i18n}
                    isRelativeTime
                    module="MyStories__story__timestamp"
                    timestamp={story.timestamp}
                  />
                </div>

                <button
                  aria-label={i18n('MyStories__download')}
                  className="MyStories__story__download"
                  onClick={() => {
                    onSave(story);
                  }}
                  type="button"
                />
                <ContextMenu
                  i18n={i18n}
                  menuOptions={[
                    {
                      icon: 'MyStories__icon--forward',
                      label: i18n('forward'),
                      onClick: () => {
                        onForward(story.messageId);
                      },
                    },
                    {
                      icon: 'MyStories__icon--save',
                      label: i18n('save'),
                      onClick: () => {
                        onSave(story);
                      },
                    },
                    {
                      icon: 'StoryListItem__icon--info',
                      label: i18n('StoryListItem__info'),
                      onClick: () => {
                        viewStory({
                          storyId: story.messageId,
                          storyViewMode: StoryViewModeType.Single,
                          shouldShowDetailsModal: true,
                        });
                      },
                    },
                    {
                      icon: 'MyStories__icon--delete',
                      label: i18n('delete'),
                      onClick: () => {
                        setConfirmDeleteStory(story);
                      },
                    },
                  ]}
                  moduleClassName="MyStories__story__more"
                  theme={Theme.Dark}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      {!myStories.length && (
        <div className="Stories__pane__list--empty">
          {i18n('Stories__list-empty')}
        </div>
      )}
    </>
  );
};
