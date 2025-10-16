// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { deleteStoryForEveryone } from './deleteStoryForEveryone.preload.js';

export async function deleteAllMyStories(): Promise<void> {
  const { stories } = window.reduxStore.getState().stories;
  const myStories = stories.filter(story =>
    Boolean(story.sendStateByConversationId)
  );

  await Promise.all(
    myStories.map(story => deleteStoryForEveryone(stories, story))
  );
}
