// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useMemo, useState } from 'react';
import { noop } from 'lodash';

import { SearchInput } from './SearchInput';
import { filterAndSortConversationsByRecent } from '../util/filterAndSortConversations';

import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { PropsType as StoriesSettingsModalPropsType } from './StoriesSettingsModal';
import type { StoryDistributionListWithMembersDataType } from '../types/Stories';
import type { UUIDStringType } from '../types/UUID';
import { Avatar, AvatarSize } from './Avatar';
import { Button, ButtonVariant } from './Button';
import { Checkbox } from './Checkbox';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenu } from './ContextMenu';
import {
  DistributionListSettings,
  EditDistributionList,
  EditMyStoriesPrivacy,
  Page as StoriesSettingsPage,
} from './StoriesSettingsModal';
import { MY_STORIES_ID, getStoryDistributionListName } from '../types/Stories';
import { Modal } from './Modal';
import { StoryDistributionListName } from './StoryDistributionListName';
import { Theme } from '../util/theme';
import { isNotNil } from '../util/isNotNil';

export type PropsType = {
  candidateConversations: Array<ConversationType>;
  distributionLists: Array<StoryDistributionListWithMembersDataType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  groupConversations: Array<ConversationType>;
  groupStories: Array<ConversationType>;
  hasFirstStoryPostExperience: boolean;
  i18n: LocalizerType;
  me: ConversationType;
  onClose: () => unknown;
  onDeleteList: (listId: string) => unknown;
  onDistributionListCreated: (
    name: string,
    viewerUuids: Array<UUIDStringType>
  ) => unknown;
  onSelectedStoryList: (memberUuids: Array<string>) => unknown;
  onSend: (
    listIds: Array<UUIDStringType>,
    conversationIds: Array<string>
  ) => unknown;
  signalConnections: Array<ConversationType>;
  toggleGroupsForStorySend: (cids: Array<string>) => unknown;
} & Pick<
  StoriesSettingsModalPropsType,
  | 'onHideMyStoriesFrom'
  | 'onRemoveMember'
  | 'onRepliesNReactionsChanged'
  | 'onViewersUpdated'
  | 'setMyStoriesToAllSignalConnections'
  | 'toggleSignalConnectionsModal'
>;

enum SendStoryPage {
  ChooseGroups = 'ChooseGroups',
  EditingDistributionList = 'EditingDistributionList',
  SendStory = 'SendStory',
  SetMyStoriesPrivacy = 'SetMyStoriesPrivacy',
}

const Page = {
  ...SendStoryPage,
  ...StoriesSettingsPage,
};

type PageType = SendStoryPage | StoriesSettingsPage;

function getListMemberUuids(
  list: StoryDistributionListWithMembersDataType,
  signalConnections: Array<ConversationType>
): Array<string> {
  const memberUuids = list.members.map(({ uuid }) => uuid).filter(isNotNil);

  if (list.id === MY_STORIES_ID && list.isBlockList) {
    const excludeUuids = new Set<string>(memberUuids);
    return signalConnections
      .map(conversation => conversation.uuid)
      .filter(isNotNil)
      .filter(uuid => !excludeUuids.has(uuid));
  }

  return memberUuids;
}

function getListViewers(
  list: StoryDistributionListWithMembersDataType,
  i18n: LocalizerType,
  signalConnections: Array<ConversationType>
): string {
  let memberCount = list.members.length;

  if (list.id === MY_STORIES_ID && list.isBlockList) {
    memberCount = list.isBlockList
      ? signalConnections.length - list.members.length
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
  hasFirstStoryPostExperience,
  i18n,
  me,
  onClose,
  onDeleteList,
  onDistributionListCreated,
  onHideMyStoriesFrom,
  onRemoveMember,
  onRepliesNReactionsChanged,
  onSelectedStoryList,
  onSend,
  onViewersUpdated,
  setMyStoriesToAllSignalConnections,
  signalConnections,
  toggleGroupsForStorySend,
  toggleSignalConnectionsModal,
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

  const [confirmRemoveGroupId, setConfirmRemoveGroupId] = useState<
    string | undefined
  >();
  const [confirmDeleteListId, setConfirmDeleteListId] = useState<
    string | undefined
  >();

  const [listIdToEdit, setListIdToEdit] = useState<string | undefined>();

  useEffect(() => {
    if (listIdToEdit) {
      setPage(Page.EditingDistributionList);
    } else {
      setPage(Page.SendStory);
    }
  }, [listIdToEdit]);

  const listToEdit = useMemo(() => {
    if (!listIdToEdit) {
      return;
    }

    return distributionLists.find(list => list.id === listIdToEdit);
  }, [distributionLists, listIdToEdit]);

  // myStoriesPrivacy, myStoriesPrivacyUuids, and myStories are only used
  // during the first time posting to My Stories experience where we have
  // to select the privacy settings.
  const ogMyStories = useMemo(
    () => distributionLists.find(list => list.id === MY_STORIES_ID),
    [distributionLists]
  );

  const initialMyStories = useMemo(
    () => ({
      allowsReplies: true,
      id: MY_STORIES_ID,
      name: i18n('Stories__mine'),
      isBlockList: ogMyStories?.isBlockList ?? true,
      members: ogMyStories?.members || [],
    }),
    [i18n, ogMyStories]
  );

  const initialMyStoriesMemberUuids = useMemo(
    () => (ogMyStories?.members || []).map(({ uuid }) => uuid).filter(isNotNil),
    [ogMyStories]
  );

  const [stagedMyStories, setStagedMyStories] =
    useState<StoryDistributionListWithMembersDataType>(initialMyStories);

  const [stagedMyStoriesMemberUuids, setStagedMyStoriesMemberUuids] = useState<
    Array<UUIDStringType>
  >(initialMyStoriesMemberUuids);

  let content: JSX.Element;
  if (page === Page.SetMyStoriesPrivacy) {
    content = (
      <EditMyStoriesPrivacy
        hasDisclaimerAbove
        i18n={i18n}
        learnMore="SendStoryModal__privacy-disclaimer"
        myStories={stagedMyStories}
        onClickExclude={() => {
          let nextSelectedContacts = stagedMyStories.members;

          if (!stagedMyStories.isBlockList) {
            setStagedMyStories(myStories => ({
              ...myStories,
              isBlockList: true,
              members: [],
            }));
            nextSelectedContacts = [];
          }

          setSelectedContacts(nextSelectedContacts);

          setPage(Page.HideStoryFrom);
        }}
        onClickOnlyShareWith={() => {
          if (!stagedMyStories.isBlockList) {
            setSelectedContacts(stagedMyStories.members);
          } else {
            setStagedMyStories(myStories => ({
              ...myStories,
              isBlockList: false,
              members: [],
            }));
          }

          setPage(Page.AddViewer);
        }}
        setSelectedContacts={setSelectedContacts}
        setMyStoriesToAllSignalConnections={() => {
          setStagedMyStories(myStories => ({
            ...myStories,
            isBlockList: true,
            members: [],
          }));
          setSelectedContacts([]);
        }}
        toggleSignalConnectionsModal={toggleSignalConnectionsModal}
      />
    );
  } else if (page === Page.EditingDistributionList && listToEdit) {
    content = (
      <DistributionListSettings
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        listToEdit={listToEdit}
        onRemoveMember={onRemoveMember}
        onRepliesNReactionsChanged={onRepliesNReactionsChanged}
        setConfirmDeleteListId={setConfirmDeleteListId}
        setMyStoriesToAllSignalConnections={setMyStoriesToAllSignalConnections}
        setPage={setPage}
        setSelectedContacts={setSelectedContacts}
        toggleSignalConnectionsModal={toggleSignalConnectionsModal}
      />
    );
  } else if (
    page === Page.ChooseViewers ||
    page === Page.NameStory ||
    page === Page.AddViewer ||
    page === Page.HideStoryFrom
  ) {
    content = (
      <EditDistributionList
        candidateConversations={candidateConversations}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        onCreateList={(name, uuids) => {
          onDistributionListCreated(name, uuids);
          setPage(Page.SendStory);
        }}
        onViewersUpdated={uuids => {
          if (listIdToEdit && page === Page.AddViewer) {
            onViewersUpdated(listIdToEdit, uuids);
            setPage(Page.EditingDistributionList);
          } else if (page === Page.ChooseViewers) {
            setPage(Page.NameStory);
          } else if (listIdToEdit && page === Page.HideStoryFrom) {
            onHideMyStoriesFrom(uuids);
            setPage(Page.SendStory);
          } else if (page === Page.HideStoryFrom || page === Page.AddViewer) {
            setStagedMyStoriesMemberUuids(uuids);
            setPage(Page.SetMyStoriesPrivacy);
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
              if (
                list.id === MY_STORIES_ID &&
                hasFirstStoryPostExperience &&
                value
              ) {
                setPage(Page.SetMyStoriesPrivacy);
                return;
              }

              setSelectedListIds(listIds => {
                if (value) {
                  listIds.add(list.id);
                } else {
                  listIds.delete(list.id);
                }
                return new Set([...listIds]);
              });
              if (value) {
                onSelectedStoryList(
                  getListMemberUuids(list, signalConnections)
                );
              }
            }}
          >
            {({ id, checkboxNode }) => (
              <ContextMenu
                i18n={i18n}
                menuOptions={
                  list.id === MY_STORIES_ID
                    ? [
                        {
                          label: i18n('StoriesSettings__context-menu'),
                          icon: 'SendStoryModal__icon--delete',
                          onClick: () => setListIdToEdit(list.id),
                        },
                      ]
                    : [
                        {
                          label: i18n('StoriesSettings__context-menu'),
                          icon: 'SendStoryModal__icon--settings',
                          onClick: () => setListIdToEdit(list.id),
                        },
                        {
                          label: i18n('SendStoryModal__delete-story'),
                          icon: 'SendStoryModal__icon--delete',
                          onClick: () => setConfirmDeleteListId(list.id),
                        },
                      ]
                }
                moduleClassName="SendStoryModal__distribution-list-context"
                onClick={noop}
                popperOptions={{
                  placement: 'bottom',
                  strategy: 'absolute',
                }}
                theme={Theme.Dark}
              >
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
                      {hasFirstStoryPostExperience && list.id === MY_STORIES_ID
                        ? i18n('SendStoryModal__choose-who-can-view')
                        : getListViewers(list, i18n, signalConnections)}
                    </div>
                  </div>
                </label>
                {checkboxNode}
              </ContextMenu>
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
              if (!group.memberships) {
                return;
              }

              setSelectedGroupIds(groupIds => {
                if (value) {
                  groupIds.add(group.id);
                } else {
                  groupIds.delete(group.id);
                }
                return new Set([...groupIds]);
              });
              if (value) {
                onSelectedStoryList(group.memberships.map(({ uuid }) => uuid));
              }
            }}
          >
            {({ id, checkboxNode }) => (
              <ContextMenu
                i18n={i18n}
                menuOptions={[
                  {
                    label: i18n('SendStoryModal__delete-story'),
                    icon: 'SendStoryModal__icon--delete',
                    onClick: () => setConfirmRemoveGroupId(group.id),
                  },
                ]}
                moduleClassName="SendStoryModal__distribution-list-context"
                onClick={noop}
                popperOptions={{
                  placement: 'bottom',
                  strategy: 'absolute',
                }}
                theme={Theme.Dark}
              >
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
              </ContextMenu>
            )}
          </Checkbox>
        ))}
      </>
    );
  }

  let modalTitle: string;
  if (page === Page.SetMyStoriesPrivacy) {
    modalTitle = i18n('SendStoryModal__my-stories-privacy');
  } else if (page === Page.HideStoryFrom) {
    modalTitle = i18n('StoriesSettings__hide-story');
  } else if (page === Page.ChooseGroups) {
    modalTitle = i18n('SendStoryModal__choose-groups');
  } else if (page === Page.NameStory) {
    modalTitle = i18n('StoriesSettings__name-story');
  } else if (page === Page.ChooseViewers || page === Page.AddViewer) {
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
  if (
    page === Page.SendStory ||
    page === Page.ChooseGroups ||
    page === Page.SetMyStoriesPrivacy
  ) {
    modalFooter = (
      <Modal.ButtonFooter moduleClassName="SendStoryModal">
        {page !== Page.SetMyStoriesPrivacy && (
          <div className="SendStoryModal__selected-lists">{selectedNames}</div>
        )}
        {page === Page.ChooseGroups && (
          <button
            aria-label={i18n('SendStoryModal__ok')}
            className="SendStoryModal__ok"
            disabled={!chosenGroupIds.size}
            onClick={() => {
              toggleGroupsForStorySend(Array.from(chosenGroupIds));
              setChosenGroupIds(new Set());
              setPage(Page.SendStory);
            }}
            type="button"
          />
        )}
        {page === Page.SendStory && (
          <button
            aria-label={i18n('SendStoryModal__send')}
            className="SendStoryModal__send"
            disabled={!selectedListIds.size && !selectedGroupIds.size}
            onClick={() => {
              onSend(Array.from(selectedListIds), Array.from(selectedGroupIds));
            }}
            type="button"
          />
        )}
        {page === Page.SetMyStoriesPrivacy && (
          <>
            <div />
            <div>
              <Button
                onClick={() => setPage(Page.SendStory)}
                variant={ButtonVariant.Secondary}
              >
                {i18n('cancel')}
              </Button>
              <Button
                onClick={() => {
                  if (stagedMyStories.isBlockList) {
                    if (stagedMyStories.members.length) {
                      onHideMyStoriesFrom(stagedMyStoriesMemberUuids);
                    } else {
                      setMyStoriesToAllSignalConnections();
                    }
                  } else {
                    onViewersUpdated(MY_STORIES_ID, stagedMyStoriesMemberUuids);
                  }

                  setSelectedContacts([]);
                  setPage(Page.SendStory);
                }}
                variant={ButtonVariant.Primary}
              >
                {i18n('save')}
              </Button>
            </div>
          </>
        )}
      </Modal.ButtonFooter>
    );
  }

  return (
    <>
      <Modal
        hasStickyButtons
        hasXButton
        i18n={i18n}
        modalFooter={modalFooter}
        onBackButtonClick={
          hasBackButton
            ? () => {
                if (listIdToEdit) {
                  if (
                    page === Page.AddViewer ||
                    page === Page.HideStoryFrom ||
                    page === Page.ChooseViewers
                  ) {
                    setPage(Page.EditingDistributionList);
                  } else {
                    setListIdToEdit(undefined);
                  }
                } else if (page === Page.SetMyStoriesPrivacy) {
                  setSelectedContacts([]);
                  setStagedMyStories(initialMyStories);
                  setStagedMyStoriesMemberUuids(initialMyStoriesMemberUuids);
                  setPage(Page.SendStory);
                } else if (
                  page === Page.HideStoryFrom ||
                  page === Page.AddViewer
                ) {
                  setSelectedContacts([]);
                  setStagedMyStories(initialMyStories);
                  setStagedMyStoriesMemberUuids(initialMyStoriesMemberUuids);
                  setPage(Page.SetMyStoriesPrivacy);
                } else if (page === Page.ChooseGroups) {
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
        theme={Theme.Dark}
      >
        {content}
      </Modal>
      {confirmRemoveGroupId && (
        <ConfirmationDialog
          actions={[
            {
              action: () => {
                toggleGroupsForStorySend([confirmRemoveGroupId]);
                setConfirmRemoveGroupId(undefined);
              },
              style: 'negative',
              text: i18n('delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmRemoveGroupId(undefined);
          }}
        >
          {i18n('SendStoryModal__confirm-remove-group')}
        </ConfirmationDialog>
      )}
      {confirmDeleteListId && (
        <ConfirmationDialog
          actions={[
            {
              action: () => {
                onDeleteList(confirmDeleteListId);
                setConfirmDeleteListId(undefined);
                // setListToEditId(undefined);
              },
              style: 'negative',
              text: i18n('delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmDeleteListId(undefined);
          }}
        >
          {i18n('StoriesSettings__delete-list--confirm')}
        </ConfirmationDialog>
      )}
    </>
  );
};
