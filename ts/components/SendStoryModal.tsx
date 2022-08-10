// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useMemo, useState } from 'react';

import { SearchInput } from './SearchInput';
import { filterAndSortConversationsByRecent } from '../util/filterAndSortConversations';

import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { StoryDistributionListDataType } from '../state/ducks/storyDistributionLists';
import type { UUIDStringType } from '../types/UUID';
import { Avatar, AvatarSize } from './Avatar';
import { Checkbox } from './Checkbox';
import { ContextMenu } from './ContextMenu';
import {
  EditDistributionList,
  Page as StoriesSettingsPage,
} from './StoriesSettingsModal';
import { MY_STORIES_ID, getStoryDistributionListName } from '../types/Stories';
import { Modal } from './Modal';
import { StoryDistributionListName } from './StoryDistributionListName';
import { Theme } from '../util/theme';

export type PropsType = {
  candidateConversations: Array<ConversationType>;
  distributionLists: Array<StoryDistributionListDataType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  groupConversations: Array<ConversationType>;
  groupStories: Array<ConversationType>;
  i18n: LocalizerType;
  me: ConversationType;
  onClose: () => unknown;
  onDistributionListCreated: (
    name: string,
    viewerUuids: Array<UUIDStringType>
  ) => unknown;
  onSend: (
    listIds: Array<UUIDStringType>,
    conversationIds: Array<string>
  ) => unknown;
  signalConnections: Array<ConversationType>;
  tagGroupsAsNewGroupStory: (cids: Array<string>) => unknown;
};

enum SendStoryPage {
  SendStory = 'SendStory',
  ChooseGroups = 'ChooseGroups',
}

const Page = {
  ...SendStoryPage,
  ...StoriesSettingsPage,
};

type PageType = SendStoryPage | StoriesSettingsPage;

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
    ? i18n('StoriesSettings__viewers--singular', ['1'])
    : i18n('StoriesSettings__viewers--plural', [String(memberCount)]);
}

export const SendStoryModal = ({
  candidateConversations,
  distributionLists,
  getPreferredBadge,
  groupConversations,
  groupStories,
  i18n,
  me,
  onClose,
  onDistributionListCreated,
  onSend,
  signalConnections,
  tagGroupsAsNewGroupStory,
}: PropsType): JSX.Element => {
  const [page, setPage] = useState<PageType>(Page.SendStory);

  const [selectedListIds, setSelectedListIds] = useState<Set<UUIDStringType>>(
    new Set()
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set()
  );
  const selectedStoryNames = useMemo(
    () =>
      distributionLists
        .filter(list => selectedListIds.has(list.id))
        .map(list => list.name)
        .concat(
          groupStories
            .filter(group => selectedGroupIds.has(group.id))
            .map(group => group.title)
        ),
    [distributionLists, groupStories, selectedGroupIds, selectedListIds]
  );

  const [searchTerm, setSearchTerm] = useState('');

  const [filteredConversations, setFilteredConversations] = useState(
    filterAndSortConversationsByRecent(
      groupConversations,
      searchTerm,
      undefined
    )
  );

  const normalizedSearchTerm = searchTerm.trim();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredConversations(
        filterAndSortConversationsByRecent(
          groupConversations,
          normalizedSearchTerm,
          undefined
        )
      );
    }, 200);
    return () => {
      clearTimeout(timeout);
    };
  }, [groupConversations, normalizedSearchTerm, setFilteredConversations]);

  const [chosenGroupIds, setChosenGroupIds] = useState<Set<string>>(
    new Set<string>()
  );

  const chosenGroupNames = useMemo(
    () =>
      filteredConversations
        .filter(group => chosenGroupIds.has(group.id))
        .map(group => group.title),
    [filteredConversations, chosenGroupIds]
  );

  const [selectedContacts, setSelectedContacts] = useState<
    Array<ConversationType>
  >([]);

  let content: JSX.Element;
  if (page === Page.ChooseViewers || page === Page.NameStory) {
    content = (
      <EditDistributionList
        candidateConversations={candidateConversations}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        onDone={(name, uuids) => {
          onDistributionListCreated(name, uuids);
          setPage(Page.SendStory);
        }}
        onViewersUpdated={() => {
          if (page === Page.ChooseViewers) {
            setPage(Page.NameStory);
          } else {
            setPage(Page.SendStory);
          }
        }}
        page={page}
        selectedContacts={selectedContacts}
        setSelectedContacts={setSelectedContacts}
      />
    );
  } else if (page === Page.ChooseGroups) {
    content = (
      <>
        <SearchInput
          disabled={groupConversations.length === 0}
          i18n={i18n}
          placeholder={i18n('contactSearchPlaceholder')}
          moduleClassName="StoriesSettingsModal__search"
          onChange={event => {
            setSearchTerm(event.target.value);
          }}
          value={searchTerm}
        />
        {filteredConversations.length ? (
          filteredConversations.map(group => (
            <Checkbox
              checked={chosenGroupIds.has(group.id)}
              key={group.id}
              label={group.title}
              moduleClassName="SendStoryModal__distribution-list"
              name="SendStoryModal__distribution-list"
              onChange={(value: boolean) => {
                setChosenGroupIds(groupIds => {
                  if (value) {
                    groupIds.add(group.id);
                  } else {
                    groupIds.delete(group.id);
                  }
                  return new Set([...groupIds]);
                });
              }}
            >
              {({ id, checkboxNode }) => (
                <>
                  <label
                    className="SendStoryModal__distribution-list__label"
                    htmlFor={id}
                  >
                    <Avatar
                      acceptedMessageRequest={group.acceptedMessageRequest}
                      avatarPath={group.avatarPath}
                      badge={undefined}
                      color={group.color}
                      conversationType={group.type}
                      i18n={i18n}
                      isMe={false}
                      sharedGroupNames={[]}
                      size={AvatarSize.THIRTY_SIX}
                      title={group.title}
                    />

                    <div className="SendStoryModal__distribution-list__info">
                      <div className="SendStoryModal__distribution-list__name">
                        {group.title}
                      </div>

                      <div className="SendStoryModal__distribution-list__description">
                        {group.membersCount === 1
                          ? i18n('ConversationHero--members-1')
                          : i18n('ConversationHero--members', [
                              String(group.membersCount),
                            ])}
                      </div>
                    </div>
                  </label>
                  {checkboxNode}
                </>
              )}
            </Checkbox>
          ))
        ) : (
          <div className="module-ForwardMessageModal__no-candidate-contacts">
            {i18n('noContactsFound')}
          </div>
        )}
      </>
    );
  } else {
    content = (
      <>
        <div className="SendStoryModal__top-bar">
          {i18n('stories')}
          <ContextMenu
            aria-label={i18n('SendStoryModal__new')}
            i18n={i18n}
            menuOptions={[
              {
                label: i18n('SendStoryModal__new-private--title'),
                description: i18n('SendStoryModal__new-private--description'),
                icon: 'SendStoryModal__icon--lock',
                onClick: () => setPage(Page.ChooseViewers),
              },
              {
                label: i18n('SendStoryModal__new-group--title'),
                description: i18n('SendStoryModal__new-group--description'),
                icon: 'SendStoryModal__icon--group',
                onClick: () => setPage(Page.ChooseGroups),
              },
            ]}
            moduleClassName="SendStoryModal__new-story"
            popperOptions={{
              placement: 'bottom',
              strategy: 'absolute',
            }}
            theme={Theme.Dark}
          >
            {i18n('SendStoryModal__new')}
          </ContextMenu>
        </div>
        {distributionLists.map(list => (
          <Checkbox
            checked={selectedListIds.has(list.id)}
            key={list.id}
            label={getStoryDistributionListName(i18n, list.id, list.name)}
            moduleClassName="SendStoryModal__distribution-list"
            name="SendStoryModal__distribution-list"
            onChange={(value: boolean) => {
              setSelectedListIds(listIds => {
                if (value) {
                  listIds.add(list.id);
                } else {
                  listIds.delete(list.id);
                }
                return new Set([...listIds]);
              });
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
        {groupStories.map(group => (
          <Checkbox
            checked={selectedGroupIds.has(group.id)}
            key={group.id}
            label={group.title}
            moduleClassName="SendStoryModal__distribution-list"
            name="SendStoryModal__distribution-list"
            onChange={(value: boolean) => {
              setSelectedGroupIds(groupIds => {
                if (value) {
                  groupIds.add(group.id);
                } else {
                  groupIds.delete(group.id);
                }
                return new Set([...groupIds]);
              });
            }}
          >
            {({ id, checkboxNode }) => (
              <>
                <label
                  className="SendStoryModal__distribution-list__label"
                  htmlFor={id}
                >
                  <Avatar
                    acceptedMessageRequest={group.acceptedMessageRequest}
                    avatarPath={group.avatarPath}
                    badge={undefined}
                    color={group.color}
                    conversationType={group.type}
                    i18n={i18n}
                    isMe={false}
                    sharedGroupNames={[]}
                    size={AvatarSize.THIRTY_SIX}
                    title={group.title}
                  />

                  <div className="SendStoryModal__distribution-list__info">
                    <div className="SendStoryModal__distribution-list__name">
                      {group.title}
                    </div>

                    <div className="SendStoryModal__distribution-list__description">
                      {group.membersCount === 1
                        ? i18n('ConversationHero--members-1')
                        : i18n('ConversationHero--members', [
                            String(group.membersCount),
                          ])}
                    </div>
                  </div>
                </label>
                {checkboxNode}
              </>
            )}
          </Checkbox>
        ))}
      </>
    );
  }

  let modalTitle: string;
  if (page === Page.ChooseGroups) {
    modalTitle = i18n('SendStoryModal__choose-groups');
  } else if (page === Page.NameStory) {
    modalTitle = i18n('StoriesSettings__name-story');
  } else if (page === Page.ChooseViewers) {
    modalTitle = i18n('StoriesSettings__choose-viewers');
  } else {
    modalTitle = i18n('SendStoryModal__title');
  }

  let selectedNames: string | undefined;
  if (page === Page.ChooseGroups) {
    selectedNames = chosenGroupNames.join(', ');
  } else {
    selectedNames = selectedStoryNames
      .map(listName => getStoryDistributionListName(i18n, listName, listName))
      .join(', ');
  }

  const hasBackButton = page !== Page.SendStory;

  let modalFooter: JSX.Element | undefined;
  if (page === Page.SendStory || page === Page.ChooseGroups) {
    modalFooter = (
      <Modal.ButtonFooter moduleClassName="SendStoryModal">
        <div className="SendStoryModal__selected-lists">{selectedNames}</div>
        {page === Page.ChooseGroups && (
          <button
            aria-label="SendStoryModal__ok"
            className="SendStoryModal__ok"
            disabled={!chosenGroupIds.size}
            onClick={() => {
              tagGroupsAsNewGroupStory(Array.from(chosenGroupIds));
              setChosenGroupIds(new Set());
              setPage(Page.SendStory);
            }}
            type="button"
          />
        )}
        {page === Page.SendStory && (
          <button
            aria-label="SendStoryModal__send"
            className="SendStoryModal__send"
            disabled={!selectedListIds.size && !selectedGroupIds.size}
            onClick={() => {
              onSend(Array.from(selectedListIds), Array.from(selectedGroupIds));
            }}
            type="button"
          />
        )}
      </Modal.ButtonFooter>
    );
  }

  return (
    <Modal
      hasStickyButtons
      hasXButton
      i18n={i18n}
      modalFooter={modalFooter}
      onBackButtonClick={
        hasBackButton
          ? () => {
              if (page === Page.ChooseGroups) {
                setChosenGroupIds(new Set());
                setPage(Page.SendStory);
              } else if (page === Page.ChooseViewers) {
                setSelectedContacts([]);
                setPage(Page.SendStory);
              } else if (page === Page.NameStory) {
                setPage(Page.ChooseViewers);
              }
            }
          : undefined
      }
      onClose={onClose}
      title={modalTitle}
    >
      {content}
    </Modal>
  );
};
