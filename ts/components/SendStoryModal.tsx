// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useMemo, useState } from 'react';
import { noop, sortBy } from 'lodash';

import { SearchInput } from './SearchInput';
import { filterAndSortConversations } from '../util/filterAndSortConversations';

import type { ConversationType } from '../state/ducks/conversations';
import type { ConversationWithStoriesType } from '../state/selectors/conversations';
import type { LocalizerType } from '../types/Util';
import { ThemeType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { PropsType as StoriesSettingsModalPropsType } from './StoriesSettingsModal';
import {
  getI18nForMyStory,
  getListViewers,
  DistributionListSettingsModal,
  EditDistributionListModal,
  EditMyStoryPrivacy,
  Page as StoriesSettingsPage,
} from './StoriesSettingsModal';
import type { StoryDistributionListWithMembersDataType } from '../types/Stories';
import type { StoryDistributionIdString } from '../types/StoryDistributionId';
import type { ServiceIdString } from '../types/ServiceId';
import { Alert } from './Alert';
import { Avatar, AvatarSize } from './Avatar';
import { Button, ButtonSize, ButtonVariant } from './Button';
import { Checkbox } from './Checkbox';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContextMenu } from './ContextMenu';

import { MY_STORY_ID, getStoryDistributionListName } from '../types/Stories';
import type { RenderModalPage, ModalPropsType } from './Modal';
import { PagedModal, ModalPage } from './Modal';
import { StoryDistributionListName } from './StoryDistributionListName';
import { isNotNil } from '../util/isNotNil';
import { StoryImage } from './StoryImage';
import type { AttachmentType } from '../types/Attachment';
import { useConfirmDiscard } from '../hooks/useConfirmDiscard';
import { getStoryBackground } from '../util/getStoryBackground';
import { makeObjectUrl, revokeObjectUrl } from '../types/VisualAttachment';
import { UserText } from './UserText';
import { Theme } from '../util/theme';

export type PropsType = {
  draftAttachment: AttachmentType;
  candidateConversations: Array<ConversationType>;
  distributionLists: Array<StoryDistributionListWithMembersDataType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  groupConversations: Array<ConversationType>;
  groupStories: Array<ConversationWithStoriesType>;
  hasFirstStoryPostExperience: boolean;
  ourConversationId: string | undefined;
  i18n: LocalizerType;
  me: ConversationType;
  onClose: () => unknown;
  onDeleteList: (listId: StoryDistributionIdString) => unknown;
  onDistributionListCreated: (
    name: string,
    viewerServiceIds: Array<ServiceIdString>
  ) => Promise<StoryDistributionIdString>;
  onSelectedStoryList: (options: {
    conversationId: string;
    distributionId: StoryDistributionIdString | undefined;
    serviceIds: Array<ServiceIdString>;
  }) => unknown;
  onSend: (
    listIds: Array<StoryDistributionIdString>,
    conversationIds: Array<string>
  ) => unknown;
  signalConnections: Array<ConversationType>;
  theme: ThemeType;
  toggleGroupsForStorySend: (cids: Array<string>) => Promise<void>;
  mostRecentActiveStoryTimestampByGroupOrDistributionList: Record<
    string,
    number
  >;
  onMediaPlaybackStart: () => void;
} & Pick<
  StoriesSettingsModalPropsType,
  | 'onHideMyStoriesFrom'
  | 'onRemoveMembers'
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

function getListMemberServiceIds(
  list: StoryDistributionListWithMembersDataType,
  signalConnections: Array<ConversationType>
): Array<ServiceIdString> {
  const memberServiceIds = list.members
    .map(({ serviceId }) => serviceId)
    .filter(isNotNil);

  if (list.id === MY_STORY_ID && list.isBlockList) {
    const excludeServiceIds = new Set<ServiceIdString>(memberServiceIds);
    return signalConnections
      .map(conversation => conversation.serviceId)
      .filter(isNotNil)
      .filter(serviceId => !excludeServiceIds.has(serviceId));
  }

  return memberServiceIds;
}

export function SendStoryModal({
  draftAttachment,
  candidateConversations,
  distributionLists,
  getPreferredBadge,
  groupConversations,
  groupStories,
  hasFirstStoryPostExperience,
  i18n,
  me,
  ourConversationId,
  onClose,
  onDeleteList,
  onDistributionListCreated,
  onHideMyStoriesFrom,
  onRemoveMembers,
  onRepliesNReactionsChanged,
  onSelectedStoryList,
  onSend,
  onViewersUpdated,
  setMyStoriesToAllSignalConnections,
  signalConnections,
  theme,
  toggleGroupsForStorySend,
  mostRecentActiveStoryTimestampByGroupOrDistributionList,
  toggleSignalConnectionsModal,
  onMediaPlaybackStart,
}: PropsType): JSX.Element {
  const [page, setPage] = useState<PageType>(Page.SendStory);

  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard(i18n);

  const [selectedListIds, setSelectedListIds] = useState<
    Set<StoryDistributionIdString>
  >(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(
    new Set()
  );
  const selectedStoryNames = useMemo(
    () =>
      distributionLists
        .filter(list => selectedListIds.has(list.id))
        .map(list => getStoryDistributionListName(i18n, list.id, list.name))
        .concat(
          groupStories
            .filter(group => selectedGroupIds.has(group.id))
            .map(group => group.title)
        ),
    [distributionLists, groupStories, selectedGroupIds, selectedListIds, i18n]
  );

  const [searchTerm, setSearchTerm] = useState('');

  const [filteredConversations, setFilteredConversations] = useState(
    filterAndSortConversations(groupConversations, searchTerm, undefined)
  );

  const normalizedSearchTerm = searchTerm.trim();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredConversations(
        filterAndSortConversations(
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

  const [hasAnnouncementsOnlyAlert, setHasAnnouncementsOnlyAlert] =
    useState(false);
  const [confirmRemoveGroupId, setConfirmRemoveGroupId] = useState<
    string | undefined
  >();
  const [confirmDeleteList, setConfirmDeleteList] = useState<
    { id: StoryDistributionIdString; name: string } | undefined
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

  // myStoriesPrivacy, myStoriesPrivacyServiceIds, and myStories are only used
  // during the first time posting to My Stories experience where we have
  // to select the privacy settings.
  const ogMyStories = useMemo(
    () => distributionLists.find(list => list.id === MY_STORY_ID),
    [distributionLists]
  );

  const initialMyStories: StoryDistributionListWithMembersDataType = useMemo(
    () => ({
      allowsReplies: true,
      id: MY_STORY_ID,
      name: i18n('icu:Stories__mine'),
      isBlockList: ogMyStories?.isBlockList ?? true,
      members: ogMyStories?.members || [],
    }),
    [i18n, ogMyStories]
  );

  const [stagedMyStories, setStagedMyStories] =
    useState<StoryDistributionListWithMembersDataType>(initialMyStories);

  let selectedNames: string | undefined;
  if (page === Page.ChooseGroups) {
    selectedNames = chosenGroupNames.join(', ');
  } else {
    selectedNames = selectedStoryNames.join(', ');
  }

  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    let url: undefined | string;

    if (draftAttachment.url) {
      setObjectUrl(draftAttachment.url);
    } else if (draftAttachment.data) {
      url = makeObjectUrl(draftAttachment.data, draftAttachment.contentType);
      setObjectUrl(url);
    }
    return () => {
      if (url) {
        revokeObjectUrl(url);
      }
    };
  }, [setObjectUrl, draftAttachment]);

  const modalCommonProps: Pick<ModalPropsType, 'hasXButton' | 'i18n'> = {
    hasXButton: true,
    i18n,
  };

  let modal: RenderModalPage;
  if (page === Page.SetMyStoriesPrivacy) {
    const footer = (
      <>
        <div />
        <div>
          <Button
            onClick={() => setPage(Page.SendStory)}
            variant={ButtonVariant.Secondary}
          >
            {i18n('icu:cancel')}
          </Button>
          <Button
            onClick={() => {
              const serviceIds = stagedMyStories.members
                .map(convo => convo.serviceId)
                .filter(isNotNil);

              if (stagedMyStories.isBlockList) {
                if (stagedMyStories.members.length) {
                  onHideMyStoriesFrom(serviceIds);
                } else {
                  setMyStoriesToAllSignalConnections();
                }
              } else {
                onViewersUpdated(MY_STORY_ID, serviceIds);
              }

              setSelectedContacts([]);
              setPage(Page.SendStory);
            }}
            variant={ButtonVariant.Primary}
          >
            {i18n('icu:save')}
          </Button>
        </div>
      </>
    );

    modal = handleClose => (
      <ModalPage
        modalName="SendStoryModal__my-stories-privacy"
        title={i18n('icu:SendStoryModal__my-stories-privacy')}
        modalFooter={footer}
        onClose={handleClose}
        {...modalCommonProps}
      >
        <EditMyStoryPrivacy
          hasDisclaimerAbove
          i18n={i18n}
          kind="privacy"
          myStories={stagedMyStories}
          signalConnectionsCount={signalConnections.length}
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
      </ModalPage>
    );
  } else if (page === Page.EditingDistributionList && listToEdit) {
    modal = handleClose => (
      <DistributionListSettingsModal
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        listToEdit={listToEdit}
        signalConnectionsCount={signalConnections.length}
        onRemoveMembers={onRemoveMembers}
        onRepliesNReactionsChanged={onRepliesNReactionsChanged}
        setConfirmDeleteList={setConfirmDeleteList}
        setMyStoriesToAllSignalConnections={setMyStoriesToAllSignalConnections}
        setPage={setPage}
        setSelectedContacts={setSelectedContacts}
        toggleSignalConnectionsModal={toggleSignalConnectionsModal}
        theme={theme}
        onBackButtonClick={() =>
          confirmDiscardIf(selectedContacts.length > 0, () =>
            setListIdToEdit(undefined)
          )
        }
        onClose={handleClose}
      />
    );
  } else if (
    page === Page.ChooseViewers ||
    page === Page.NameStory ||
    page === Page.AddViewer ||
    page === Page.HideStoryFrom
  ) {
    modal = handleClose => (
      <EditDistributionListModal
        candidateConversations={candidateConversations}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        onCreateList={async (name, serviceIds) => {
          const newDistributionListId = await onDistributionListCreated(
            name,
            serviceIds
          );

          setSelectedContacts([]);
          setSelectedListIds(
            listIds => new Set([...listIds, newDistributionListId])
          );

          setPage(Page.SendStory);
        }}
        onViewersUpdated={serviceIds => {
          if (listIdToEdit && page === Page.AddViewer) {
            onViewersUpdated(listIdToEdit, serviceIds);
            setPage(Page.EditingDistributionList);
          } else if (page === Page.ChooseViewers) {
            setPage(Page.NameStory);
          } else if (listIdToEdit && page === Page.HideStoryFrom) {
            onHideMyStoriesFrom(serviceIds);
            setPage(Page.SendStory);
          } else if (page === Page.HideStoryFrom || page === Page.AddViewer) {
            const serviceIdSet = new Set(serviceIds);
            const members = candidateConversations.filter(convo =>
              convo.serviceId ? serviceIdSet.has(convo.serviceId) : false
            );
            setStagedMyStories(myStories => ({
              ...myStories,
              members,
            }));
            setPage(Page.SetMyStoriesPrivacy);
          } else {
            setPage(Page.SendStory);
          }
        }}
        page={page}
        onClose={handleClose}
        onBackButtonClick={() =>
          confirmDiscardIf(selectedContacts.length > 0, () => {
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
            } else if (page === Page.HideStoryFrom || page === Page.AddViewer) {
              setSelectedContacts([]);
              setStagedMyStories(initialMyStories);
              setPage(Page.SetMyStoriesPrivacy);
            } else if (page === Page.ChooseViewers) {
              setSelectedContacts([]);
              setPage(Page.SendStory);
            } else if (page === Page.NameStory) {
              setPage(Page.ChooseViewers);
            }
          })
        }
        selectedContacts={selectedContacts}
        setSelectedContacts={setSelectedContacts}
        theme={theme}
      />
    );
  } else if (page === Page.ChooseGroups) {
    const footer = (
      <>
        <div className="SendStoryModal__selected-lists">{selectedNames}</div>
        {selectedNames.length > 0 && (
          <button
            aria-label={i18n('icu:ok')}
            className="SendStoryModal__ok"
            disabled={!chosenGroupIds.size}
            onClick={async () => {
              await toggleGroupsForStorySend(Array.from(chosenGroupIds));
              setChosenGroupIds(new Set());
              setSelectedGroupIds(chosenGroupIds);
              setPage(Page.SendStory);
            }}
            type="button"
          />
        )}
      </>
    );

    modal = handleClose => (
      <ModalPage
        modalName="SendStoryModal__choose-groups"
        title={i18n('icu:SendStoryModal__choose-groups')}
        moduleClassName="SendStoryModal"
        modalFooter={footer}
        onClose={handleClose}
        {...modalCommonProps}
      >
        <SearchInput
          disabled={groupConversations.length === 0}
          i18n={i18n}
          placeholder={i18n('icu:contactSearchPlaceholder')}
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
                if (group.announcementsOnly && !group.areWeAdmin) {
                  setHasAnnouncementsOnlyAlert(true);
                  return;
                }

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
                      avatarUrl={group.avatarUrl}
                      badge={undefined}
                      color={group.color}
                      conversationType={group.type}
                      i18n={i18n}
                      isMe={false}
                      sharedGroupNames={[]}
                      size={AvatarSize.THIRTY_TWO}
                      title={group.title}
                    />

                    <div className="SendStoryModal__distribution-list__info">
                      <div className="SendStoryModal__distribution-list__name">
                        <UserText text={group.title} />
                      </div>

                      <div className="SendStoryModal__distribution-list__description">
                        {i18n('icu:ConversationHero--members', {
                          count: group.membersCount ?? 0,
                        })}
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
            {i18n('icu:noGroupsFound')}
          </div>
        )}
      </ModalPage>
    );
  } else {
    const footer = (
      <>
        <div className="SendStoryModal__selected-lists">{selectedNames}</div>
        {selectedNames.length > 0 && (
          <button
            aria-label={i18n('icu:SendStoryModal__send')}
            className="SendStoryModal__send"
            disabled={!selectedListIds.size && !selectedGroupIds.size}
            onClick={() => {
              onSend(Array.from(selectedListIds), Array.from(selectedGroupIds));
            }}
            type="button"
          />
        )}
      </>
    );

    const attachment = {
      ...draftAttachment,
      url: objectUrl,
    };

    // my stories always first, the rest sorted by recency
    const fullList = sortBy(
      [...groupStories, ...distributionLists],
      listOrGroup => {
        if (listOrGroup.id === MY_STORY_ID) {
          return Number.NEGATIVE_INFINITY;
        }
        return (
          (mostRecentActiveStoryTimestampByGroupOrDistributionList[
            listOrGroup.id
          ] ?? 0) * -1
        );
      }
    );

    const renderDistributionList = (
      list: StoryDistributionListWithMembersDataType
    ): JSX.Element => {
      return (
        <Checkbox
          checked={selectedListIds.has(list.id)}
          key={list.id}
          label={getStoryDistributionListName(i18n, list.id, list.name)}
          moduleClassName="SendStoryModal__distribution-list"
          name="SendStoryModal__distribution-list"
          onChange={(value: boolean) => {
            if (
              list.id === MY_STORY_ID &&
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
            if (value && ourConversationId) {
              onSelectedStoryList({
                conversationId: ourConversationId,
                distributionId: list.id,
                serviceIds: getListMemberServiceIds(list, signalConnections),
              });
            }
          }}
        >
          {({ id, checkboxNode }) => (
            <ContextMenu
              i18n={i18n}
              menuOptions={
                list.id === MY_STORY_ID
                  ? [
                      {
                        label: i18n('icu:StoriesSettings__context-menu'),
                        icon: 'SendStoryModal__icon--delete',
                        onClick: () => setListIdToEdit(list.id),
                      },
                    ]
                  : [
                      {
                        label: i18n('icu:StoriesSettings__context-menu'),
                        icon: 'SendStoryModal__icon--settings',
                        onClick: () => setListIdToEdit(list.id),
                      },
                      {
                        label: i18n('icu:SendStoryModal__delete-story'),
                        icon: 'SendStoryModal__icon--delete',
                        onClick: () => setConfirmDeleteList(list),
                      },
                    ]
              }
              moduleClassName="SendStoryModal__distribution-list-context"
              onClick={noop}
              popperOptions={{
                placement: 'bottom',
                strategy: 'absolute',
              }}
              theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
            >
              <label
                className="SendStoryModal__distribution-list__label"
                htmlFor={id}
              >
                {list.id === MY_STORY_ID ? (
                  <Avatar
                    acceptedMessageRequest={me.acceptedMessageRequest}
                    avatarUrl={me.avatarUrl}
                    badge={undefined}
                    color={me.color}
                    conversationType={me.type}
                    i18n={i18n}
                    isMe
                    sharedGroupNames={me.sharedGroupNames}
                    size={AvatarSize.THIRTY_TWO}
                    storyRing={undefined}
                    title={me.title}
                  />
                ) : (
                  <span className="StoriesSettingsModal__list__avatar--custom" />
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
                    {hasFirstStoryPostExperience && list.id === MY_STORY_ID ? (
                      i18n('icu:SendStoryModal__choose-who-can-view')
                    ) : (
                      <>
                        <span className="SendStoryModal__rtl-span">
                          {list.id === MY_STORY_ID
                            ? getI18nForMyStory(list, i18n)
                            : i18n('icu:SendStoryModal__custom-story')}
                        </span>
                        <span className="SendStoryModal__rtl-span">
                          &nbsp;&middot;&nbsp;
                        </span>
                        <span className="SendStoryModal__rtl-span">
                          {list.isBlockList && list.members.length > 0
                            ? i18n('icu:SendStoryModal__excluded', {
                                count: list.members.length,
                              })
                            : getListViewers(list, i18n, signalConnections)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </label>
              {checkboxNode}
            </ContextMenu>
          )}
        </Checkbox>
      );
    };

    const renderGroup = (group: ConversationWithStoriesType) => {
      return (
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

            if (group.announcementsOnly && !group.areWeAdmin) {
              setHasAnnouncementsOnlyAlert(true);
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
              onSelectedStoryList({
                conversationId: group.id,
                distributionId: undefined,
                serviceIds: group.memberships.map(({ aci }) => aci),
              });
            }
          }}
        >
          {({ id, checkboxNode }) => (
            <ContextMenu
              i18n={i18n}
              menuOptions={[
                {
                  label: i18n('icu:SendStoryModal__delete-story'),
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
              theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
            >
              <label
                className="SendStoryModal__distribution-list__label"
                htmlFor={id}
              >
                <Avatar
                  acceptedMessageRequest={group.acceptedMessageRequest}
                  avatarUrl={group.avatarUrl}
                  badge={undefined}
                  color={group.color}
                  conversationType={group.type}
                  i18n={i18n}
                  isMe={false}
                  sharedGroupNames={[]}
                  size={AvatarSize.THIRTY_TWO}
                  storyRing={group.hasStories}
                  title={group.title}
                />

                <div className="SendStoryModal__distribution-list__info">
                  <div className="SendStoryModal__distribution-list__name">
                    <UserText text={group.title} />
                  </div>

                  <div className="SendStoryModal__distribution-list__description">
                    <span className="SendStoryModal__rtl-span">
                      {i18n('icu:SendStoryModal__group-story')}
                    </span>
                    <span className="SendStoryModal__rtl-span">
                      &nbsp;&middot;&nbsp;
                    </span>
                    <span className="SendStoryModal__rtl-span">
                      {i18n('icu:ConversationHero--members', {
                        count: group.membersCount ?? 0,
                      })}
                    </span>
                  </div>
                </div>
              </label>
              {checkboxNode}
            </ContextMenu>
          )}
        </Checkbox>
      );
    };

    modal = handleClose => (
      <ModalPage
        modalName="SendStoryModal__title"
        title={i18n('icu:SendStoryModal__title')}
        moduleClassName="SendStoryModal"
        modalFooter={footer}
        onClose={handleClose}
        {...modalCommonProps}
      >
        <div
          className="SendStoryModal__story-preview"
          style={{ backgroundImage: getStoryBackground(attachment) }}
        >
          <StoryImage
            i18n={i18n}
            firstName={i18n('icu:you')}
            queueStoryDownload={noop}
            storyId="story-id"
            label="label"
            moduleClassName="SendStoryModal__story"
            attachment={attachment}
            onMediaPlaybackStart={onMediaPlaybackStart}
          />
        </div>
        <div className="SendStoryModal__top-bar">
          <div className="SendStoryModal__top-bar-title">
            {i18n('icu:stories')}
          </div>
          <div className="SendStoryModal__top-bar-actions">
            <ContextMenu
              aria-label={i18n('icu:SendStoryModal__new')}
              i18n={i18n}
              menuOptions={[
                {
                  label: i18n('icu:SendStoryModal__new-custom--title'),
                  description: i18n(
                    'icu:SendStoryModal__new-custom--description'
                  ),
                  icon: 'SendStoryModal__icon--custom',
                  onClick: () => setPage(Page.ChooseViewers),
                },
                {
                  label: i18n('icu:SendStoryModal__new-group--title'),
                  description: i18n(
                    'icu:SendStoryModal__new-group--description'
                  ),
                  icon: 'SendStoryModal__icon--group',
                  onClick: () => setPage(Page.ChooseGroups),
                },
              ]}
              moduleClassName="SendStoryModal__new-story"
              popperOptions={{
                placement: 'bottom',
                strategy: 'absolute',
              }}
              theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
            >
              {({ onClick, onKeyDown, ref, menuNode }) => (
                <div>
                  <Button
                    ref={ref}
                    className="SendStoryModal__new-story__button"
                    variant={ButtonVariant.Secondary}
                    size={ButtonSize.Small}
                    onClick={onClick}
                    onKeyDown={onKeyDown}
                  >
                    {i18n('icu:SendStoryModal__new')}
                  </Button>
                  {menuNode}
                </div>
              )}
            </ContextMenu>
          </div>
        </div>
        {fullList.map(listOrGroup =>
          // only group has a type field
          'type' in listOrGroup
            ? renderGroup(listOrGroup)
            : renderDistributionList(listOrGroup)
        )}
      </ModalPage>
    );
  }

  return (
    <>
      {!confirmDiscardModal && (
        <PagedModal
          modalName="SendStoryModal"
          theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
          onClose={() => confirmDiscardIf(selectedContacts.length > 0, onClose)}
        >
          {modal}
        </PagedModal>
      )}
      {hasAnnouncementsOnlyAlert && (
        <Alert
          body={i18n('icu:SendStoryModal__announcements-only')}
          i18n={i18n}
          onClose={() => setHasAnnouncementsOnlyAlert(false)}
          theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
        />
      )}
      {confirmRemoveGroupId && (
        <ConfirmationDialog
          dialogName="SendStoryModal.confirmRemoveGroupId"
          actions={[
            {
              action: () => {
                void toggleGroupsForStorySend([confirmRemoveGroupId]);
                setConfirmRemoveGroupId(undefined);
              },
              style: 'negative',
              text: i18n('icu:delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmRemoveGroupId(undefined);
          }}
          theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
        >
          {i18n('icu:SendStoryModal__confirm-remove-group')}
        </ConfirmationDialog>
      )}
      {confirmDeleteList && (
        <ConfirmationDialog
          dialogName="SendStoryModal.confirmDeleteList"
          actions={[
            {
              action: () => {
                onDeleteList(confirmDeleteList.id);
                setConfirmDeleteList(undefined);
              },
              style: 'negative',
              text: i18n('icu:delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmDeleteList(undefined);
          }}
          theme={theme === ThemeType.dark ? Theme.Dark : Theme.Light}
        >
          {i18n('icu:StoriesSettings__delete-list--confirm', {
            name: confirmDeleteList.name,
          })}
        </ConfirmationDialog>
      )}
      {confirmDiscardModal}
    </>
  );
}
