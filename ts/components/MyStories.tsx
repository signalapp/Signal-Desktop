// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';
import type { MyStoryType, StoryViewType } from '../types/Stories';
import type { LocalizerType } from '../types/Util';
import type { ViewStoryActionCreatorType } from '../state/ducks/stories';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenu } from './ContextMenu';
import { MY_STORIES_ID, StoryViewModeType } from '../types/Stories';
import { MessageTimestamp } from './conversation/MessageTimestamp';
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
          <div className="MyStories__distribution" key={list.distributionId}>
            <div className="MyStories__distribution__title">
              {list.distributionId === MY_STORIES_ID
                ? i18n('Stories__mine')
                : list.distributionName}
            </div>
            {list.stories.map(story => (
              <div className="MyStories__story" key={story.timestamp}>
                {story.attachment && (
                  <button
                    aria-label={i18n('MyStories__story')}
                    className="MyStories__story__preview"
                    onClick={() =>
                      viewStory(story.messageId, StoryViewModeType.Single)
                    }
                    type="button"
                  >
                    <StoryImage
                      attachment={story.attachment}
                      i18n={i18n}
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
                  buttonClassName="MyStories__story__more"
                  i18n={i18n}
                  menuOptions={[
                    {
                      icon: 'MyStories__icon--save',
                      label: i18n('save'),
                      onClick: () => {
                        onSave(story);
                      },
                    },
                    {
                      icon: 'MyStories__icon--forward',
                      label: i18n('forward'),
                      onClick: () => {
                        onForward(story.messageId);
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
