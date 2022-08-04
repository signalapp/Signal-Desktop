// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useMemo, useState } from 'react';

import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import type { StoryDistributionListDataType } from '../state/ducks/storyDistributionLists';
import type { UUIDStringType } from '../types/UUID';
import { Avatar, AvatarSize } from './Avatar';
import { Checkbox } from './Checkbox';
import { MY_STORIES_ID, getStoryDistributionListName } from '../types/Stories';
import { Modal } from './Modal';
import { StoryDistributionListName } from './StoryDistributionListName';

export type PropsType = {
  distributionLists: Array<StoryDistributionListDataType>;
  i18n: LocalizerType;
  me: ConversationType;
  onClose: () => unknown;
  onSend: (listIds: Array<UUIDStringType>) => unknown;
  signalConnections: Array<ConversationType>;
};

function getListViewers(
  list: StoryDistributionListDataType,
  i18n: LocalizerType,
  signalConnections: Array<ConversationType>
): string {
  let memberCount = list.memberUuids.length;

  if (list.id === MY_STORIES_ID && list.isBlockList) {
    memberCount = list.isBlockList
      ? signalConnections.length - list.memberUuids.length
      : signalConnections.length;
  }

  return memberCount === 1
    ? i18n('StoriesSettingsModal__viewers--singular', ['1'])
    : i18n('StoriesSettings__viewers--plural', [String(memberCount)]);
}

export const SendStoryModal = ({
  distributionLists,
  i18n,
  me,
  onClose,
  onSend,
  signalConnections,
}: PropsType): JSX.Element => {
  const [selectedListIds, setSelectedListIds] = useState<Set<UUIDStringType>>(
    new Set()
  );
  const selectedListNames = useMemo(
    () =>
      distributionLists
        .filter(list => selectedListIds.has(list.id))
        .map(list => list.name),
    [distributionLists, selectedListIds]
  );

  return (
    <Modal
      hasXButton
      i18n={i18n}
      onClose={onClose}
      title={i18n('SendStoryModal__title')}
    >
      {distributionLists.map(list => (
        <Checkbox
          checked={selectedListIds.has(list.id)}
          key={list.id}
          label={getStoryDistributionListName(i18n, list.id, list.name)}
          moduleClassName="SendStoryModal__distribution-list"
          name="SendStoryModal__distribution-list"
          onChange={(value: boolean) => {
            if (value) {
              setSelectedListIds(listIds => {
                listIds.add(list.id);
                return new Set([...listIds]);
              });
            } else {
              setSelectedListIds(listIds => {
                listIds.delete(list.id);
                return new Set([...listIds]);
              });
            }
          }}
        >
          {({ id, checkboxNode }) => (
            <>
              <label
                className="SendStoryModal__distribution-list__label"
                htmlFor={id}
              >
                {list.id === MY_STORIES_ID ? (
                  <Avatar
                    acceptedMessageRequest={me.acceptedMessageRequest}
                    avatarPath={me.avatarPath}
                    badge={undefined}
                    color={me.color}
                    conversationType={me.type}
                    i18n={i18n}
                    isMe
                    sharedGroupNames={me.sharedGroupNames}
                    size={AvatarSize.THIRTY_SIX}
                    title={me.title}
                  />
                ) : (
                  <span className="StoriesSettingsModal__list__avatar--private" />
                )}

                <div className="SendStoryModal__distribution-list__info">
                  <div className="SendStoryModal__distribution-list__name">
                    <StoryDistributionListName
                      i18n={i18n}
                      id={list.id}
                      name={list.name}
                    />
                  </div>

                  <div className="SendStoryModal__distribution-list__description">
                    {getListViewers(list, i18n, signalConnections)}
                  </div>
                </div>
              </label>
              {checkboxNode}
            </>
          )}
        </Checkbox>
      ))}

      <Modal.ButtonFooter moduleClassName="SendStoryModal">
        <div className="SendStoryModal__selected-lists">
          {selectedListNames
            .map(listName =>
              getStoryDistributionListName(i18n, listName, listName)
            )
            .join(', ')}
        </div>
        <button
          aria-label="SendStoryModal__send"
          className="SendStoryModal__send"
          disabled={!selectedListIds.size}
          onClick={() => {
            onSend(Array.from(selectedListIds));
          }}
          type="button"
        />
      </Modal.ButtonFooter>
    </Modal>
  );
};
