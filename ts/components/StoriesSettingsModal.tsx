// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { noop } from 'lodash';

import type { ConversationType } from '../state/ducks/conversations';
import type { ConversationWithStoriesType } from '../state/selectors/conversations';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import type { Row } from './ConversationList';
import type { StoryDistributionListWithMembersDataType } from '../types/Stories';
import type { StoryDistributionIdString } from '../types/StoryDistributionId';
import type { ServiceIdString } from '../types/ServiceId';
import type { RenderModalPage, ModalPropsType } from './Modal';
import { Avatar, AvatarSize } from './Avatar';
import { Button, ButtonVariant } from './Button';
import { Checkbox } from './Checkbox';
import { ConfirmationDialog } from './ConfirmationDialog';
import { ContactPills } from './ContactPills';
import { ContactPill } from './ContactPill';
import { ConversationList, RowType } from './ConversationList';
import { Input } from './Input';
import { I18n } from './I18n';
import { MY_STORY_ID, getStoryDistributionListName } from '../types/Stories';
import { PagedModal, ModalPage } from './Modal';
import { SearchInput } from './SearchInput';
import { StoryDistributionListName } from './StoryDistributionListName';
import { filterAndSortConversations } from '../util/filterAndSortConversations';
import { isNotNil } from '../util/isNotNil';
import {
  shouldNeverBeCalled,
  asyncShouldNeverBeCalled,
} from '../util/shouldNeverBeCalled';
import { useConfirmDiscard } from '../hooks/useConfirmDiscard';
import { getGroupMemberships } from '../util/getGroupMemberships';
import { strictAssert } from '../util/assert';
import { UserText } from './UserText';
import { SizeObserver } from '../hooks/useSizeObserver';

export type PropsType = {
  candidateConversations: Array<ConversationType>;
  distributionLists: Array<StoryDistributionListWithMembersDataType>;
  groupStories: Array<ConversationWithStoriesType>;
  signalConnections: Array<ConversationType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  hideStoriesSettings: () => unknown;
  i18n: LocalizerType;
  me: ConversationType;
  onDeleteList: (listId: string) => unknown;
  toggleGroupsForStorySend: (groupIds: Array<string>) => unknown;
  onDistributionListCreated: (
    name: string,
    viewerServiceIds: Array<ServiceIdString>
  ) => Promise<string>;
  onHideMyStoriesFrom: (viewerServiceIds: Array<ServiceIdString>) => unknown;
  onRemoveMembers: (
    listId: string,
    serviceIds: Array<ServiceIdString>
  ) => unknown;
  onRepliesNReactionsChanged: (
    listId: string,
    allowsReplies: boolean
  ) => unknown;
  onViewersUpdated: (
    listId: string,
    viewerServiceIds: Array<ServiceIdString>
  ) => unknown;
  setMyStoriesToAllSignalConnections: () => unknown;
  storyViewReceiptsEnabled: boolean;
  theme: ThemeType;
  toggleSignalConnectionsModal: () => unknown;
  setStoriesDisabled: (value: boolean) => void;
  getConversationByServiceId: (
    serviceId: ServiceIdString
  ) => ConversationType | undefined;
};

export enum Page {
  DistributionLists = 'DistributionLists',
  AddViewer = 'AddViewer',
  ChooseViewers = 'ChooseViewers',
  NameStory = 'NameStory',
  HideStoryFrom = 'HideStoryFrom',
}

function filterConversations(
  conversations: ReadonlyArray<ConversationType>,
  searchTerm: string
) {
  return filterAndSortConversations(
    conversations,
    searchTerm,
    undefined
  ).filter(conversation => conversation.serviceId);
}

const modalCommonProps: Pick<ModalPropsType, 'hasXButton' | 'moduleClassName'> =
  {
    hasXButton: true,
    moduleClassName: 'StoriesSettingsModal__modal',
  };

export function getListViewers(
  list: StoryDistributionListWithMembersDataType,
  i18n: LocalizerType,
  signalConnections: Array<ConversationType>
): string {
  let memberCount = list.members.length;

  if (list.id === MY_STORY_ID && list.isBlockList) {
    memberCount = list.isBlockList
      ? signalConnections.length - list.members.length
      : signalConnections.length;
  }

  return i18n('icu:StoriesSettings__viewers', { count: memberCount });
}

export function getI18nForMyStory(
  list: StoryDistributionListWithMembersDataType,
  i18n: LocalizerType
): string {
  if (list.members.length === 0) {
    return i18n('icu:StoriesSettings__mine__all--label');
  }

  if (!list.isBlockList) {
    return i18n('icu:SendStoryModal__only-share-with');
  }

  return i18n('icu:StoriesSettings__mine__all--label');
}

type DistributionListItemProps = {
  i18n: LocalizerType;
  distributionList: StoryDistributionListWithMembersDataType;
  me: ConversationType;
  signalConnections: Array<ConversationType>;
  onSelectItemToEdit(id: StoryDistributionIdString): void;
};

function DistributionListItem({
  i18n,
  distributionList,
  me,
  signalConnections,
  onSelectItemToEdit,
}: DistributionListItemProps) {
  const isMyStory = distributionList.id === MY_STORY_ID;
  return (
    <button
      className="StoriesSettingsModal__list"
      onClick={() => {
        onSelectItemToEdit(distributionList.id);
      }}
      type="button"
    >
      <span className="StoriesSettingsModal__list__left">
        {isMyStory ? (
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
            title={me.title}
          />
        ) : (
          <span className="StoriesSettingsModal__list__avatar--custom" />
        )}
        <span className="StoriesSettingsModal__list__title">
          <StoryDistributionListName
            i18n={i18n}
            id={distributionList.id}
            name={distributionList.name}
          />
          <span className="StoriesSettingsModal__list__viewers">
            {isMyStory
              ? getI18nForMyStory(distributionList, i18n)
              : i18n('icu:StoriesSettings__custom-story-subtitle')}
            &nbsp;&middot;&nbsp;
            {getListViewers(distributionList, i18n, signalConnections)}
          </span>
        </span>
      </span>
    </button>
  );
}

type GroupStoryItemProps = {
  i18n: LocalizerType;
  groupStory: ConversationType;
  onSelectGroupToView(id: string): void;
};

function GroupStoryItem({
  i18n,
  groupStory,
  onSelectGroupToView,
}: GroupStoryItemProps) {
  return (
    <button
      className="StoriesSettingsModal__list"
      onClick={() => {
        onSelectGroupToView(groupStory.id);
      }}
      type="button"
    >
      <span className="StoriesSettingsModal__list__left">
        <Avatar
          acceptedMessageRequest={groupStory.acceptedMessageRequest}
          avatarUrl={groupStory.avatarUrl}
          badge={undefined}
          color={groupStory.color}
          conversationType={groupStory.type}
          i18n={i18n}
          isMe={false}
          sharedGroupNames={[]}
          size={AvatarSize.THIRTY_TWO}
          title={groupStory.title}
        />
        <span className="StoriesSettingsModal__list__title">
          <UserText text={groupStory.title} />
          <span className="StoriesSettingsModal__list__viewers">
            {i18n('icu:StoriesSettings__group-story-subtitle')}
            &nbsp;&middot;&nbsp;
            {i18n('icu:StoriesSettings__viewers', {
              count: groupStory.membersCount ?? 0,
            })}
          </span>
        </span>
      </span>
    </button>
  );
}

export function StoriesSettingsModal({
  candidateConversations,
  distributionLists,
  groupStories,
  signalConnections,
  getPreferredBadge,
  hideStoriesSettings,
  i18n,
  me,
  onDeleteList,
  toggleGroupsForStorySend,
  onDistributionListCreated,
  onHideMyStoriesFrom,
  onRemoveMembers,
  onRepliesNReactionsChanged,
  onViewersUpdated,
  setMyStoriesToAllSignalConnections,
  storyViewReceiptsEnabled,
  toggleSignalConnectionsModal,
  theme,
  setStoriesDisabled,
  getConversationByServiceId,
}: PropsType): JSX.Element {
  const [confirmDiscardModal, confirmDiscardIf] = useConfirmDiscard(i18n);

  const [listToEditId, setListToEditId] = useState<string | undefined>(
    undefined
  );

  const listToEdit = useMemo(
    () => distributionLists.find(x => x.id === listToEditId),
    [distributionLists, listToEditId]
  );

  const [groupToViewId, setGroupToViewId] = useState<string | null>(null);
  const groupToView = useMemo(() => {
    return groupStories.find(group => {
      return group.id === groupToViewId;
    });
  }, [groupStories, groupToViewId]);

  const [page, setPage] = useState<Page>(Page.DistributionLists);

  const [selectedContacts, setSelectedContacts] = useState<
    Array<ConversationType>
  >([]);

  const resetChooseViewersScreen = useCallback(() => {
    setSelectedContacts([]);
    setPage(Page.DistributionLists);
  }, []);

  const [confirmDeleteList, setConfirmDeleteList] = useState<
    { id: string; name: string } | undefined
  >();

  const [confirmRemoveGroup, setConfirmRemoveGroup] = useState<{
    id: string;
    title: string;
  } | null>(null);

  let modal: RenderModalPage | null;

  if (page !== Page.DistributionLists) {
    const isChoosingViewers =
      page === Page.ChooseViewers || page === Page.AddViewer;

    modal = onClose => (
      <EditDistributionListModal
        candidateConversations={candidateConversations}
        getPreferredBadge={getPreferredBadge}
        i18n={i18n}
        page={page}
        onClose={onClose}
        onCreateList={(name, serviceIds) => {
          void onDistributionListCreated(name, serviceIds);
          resetChooseViewersScreen();
        }}
        onBackButtonClick={() =>
          confirmDiscardIf(selectedContacts.length > 0, () => {
            if (page === Page.HideStoryFrom) {
              resetChooseViewersScreen();
            } else if (page === Page.NameStory) {
              setPage(Page.ChooseViewers);
            } else if (isChoosingViewers) {
              resetChooseViewersScreen();
            } else if (listToEdit) {
              setListToEditId(undefined);
            } else if (groupToView) {
              setGroupToViewId(null);
            }
          })
        }
        onViewersUpdated={serviceIds => {
          if (listToEditId && page === Page.AddViewer) {
            onViewersUpdated(listToEditId, serviceIds);
            resetChooseViewersScreen();
          }

          if (page === Page.ChooseViewers) {
            setPage(Page.NameStory);
          }

          if (page === Page.HideStoryFrom) {
            onHideMyStoriesFrom(serviceIds);
            resetChooseViewersScreen();
          }
        }}
        selectedContacts={selectedContacts}
        setSelectedContacts={setSelectedContacts}
        theme={theme}
      />
    );
  } else if (listToEdit) {
    modal = handleClose => (
      <DistributionListSettingsModal
        key="settings-modal"
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
        onBackButtonClick={() => setListToEditId(undefined)}
        onClose={handleClose}
      />
    );
  } else if (groupToView) {
    modal = onClose => (
      <GroupStorySettingsModal
        i18n={i18n}
        group={groupToView}
        onClose={onClose}
        onBackButtonClick={() => setGroupToViewId(null)}
        getConversationByServiceId={getConversationByServiceId}
        onRemoveGroup={group => {
          setConfirmRemoveGroup({
            id: group.id,
            title: group.title,
          });
        }}
      />
    );
  } else {
    modal = onClose => (
      <ModalPage
        modalName="StoriesSettingsModal__list"
        i18n={i18n}
        onClose={onClose}
        title={i18n('icu:StoriesSettings__title')}
        {...modalCommonProps}
      >
        <p className="StoriesSettingsModal__description">
          {i18n('icu:StoriesSettings__description')}
        </p>

        <div className="StoriesSettingsModal__listHeader">
          <h2 className="StoriesSettingsModal__listHeader__title">
            {i18n('icu:StoriesSettings__my_stories')}
          </h2>
        </div>

        <button
          className="StoriesSettingsModal__list"
          onClick={() => {
            setPage(Page.ChooseViewers);
          }}
          type="button"
        >
          <span className="StoriesSettingsModal__list__left">
            <span className="StoriesSettingsModal__list__avatar--new" />
            <span className="StoriesSettingsModal__list__title">
              {i18n('icu:StoriesSettings__new-list')}
            </span>
          </span>
        </button>

        {distributionLists.map(distributionList => {
          return (
            <DistributionListItem
              key={distributionList.id}
              i18n={i18n}
              me={me}
              distributionList={distributionList}
              signalConnections={signalConnections}
              onSelectItemToEdit={setListToEditId}
            />
          );
        })}

        {groupStories.map(groupStory => {
          return (
            <GroupStoryItem
              key={groupStory.id}
              i18n={i18n}
              groupStory={groupStory}
              onSelectGroupToView={setGroupToViewId}
            />
          );
        })}

        <hr className="StoriesSettingsModal__divider" />

        <Checkbox
          disabled
          checked={storyViewReceiptsEnabled}
          description={i18n('icu:StoriesSettings__view-receipts--description')}
          label={i18n('icu:StoriesSettings__view-receipts--label')}
          moduleClassName="StoriesSettingsModal__checkbox"
          name="view-receipts"
          onChange={noop}
        />

        <div className="StoriesSettingsModal__stories-off-container">
          <p className="StoriesSettingsModal__stories-off-text">
            {i18n('icu:Stories__settings-toggle--description')}
          </p>
          <Button
            className="Preferences__stories-off"
            variant={ButtonVariant.SecondaryDestructive}
            onClick={async () => {
              setStoriesDisabled(true);
              onClose();
            }}
          >
            {i18n('icu:Stories__settings-toggle--button')}
          </Button>
        </div>
      </ModalPage>
    );
  }

  return (
    <>
      {!confirmDiscardModal && (
        <PagedModal
          modalName="StoriesSettingsModal"
          moduleClassName="StoriesSettingsModal"
          onClose={() =>
            confirmDiscardIf(selectedContacts.length > 0, hideStoriesSettings)
          }
        >
          {modal}
        </PagedModal>
      )}
      {confirmDeleteList && (
        <ConfirmationDialog
          dialogName="StoriesSettings.deleteList"
          actions={[
            {
              action: () => {
                onDeleteList(confirmDeleteList.id);
                setListToEditId(undefined);
              },
              style: 'negative',
              text: i18n('icu:delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmDeleteList(undefined);
          }}
        >
          {i18n('icu:StoriesSettings__delete-list--confirm', {
            name: confirmDeleteList.name,
          })}
        </ConfirmationDialog>
      )}
      {confirmRemoveGroup != null && (
        <ConfirmationDialog
          dialogName="StoriesSettings.removeGroupStory"
          actions={[
            {
              action: () => {
                toggleGroupsForStorySend([confirmRemoveGroup.id]);
                setConfirmRemoveGroup(null);
                setGroupToViewId(null);
              },
              style: 'negative',
              text: i18n('icu:delete'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmRemoveGroup(null);
          }}
        >
          {i18n('icu:StoriesSettings__remove_group--confirm', {
            groupTitle: confirmRemoveGroup.title,
          })}
        </ConfirmationDialog>
      )}
      {confirmDiscardModal}
    </>
  );
}

type DistributionListSettingsModalPropsType = {
  i18n: LocalizerType;
  listToEdit: StoryDistributionListWithMembersDataType;
  signalConnectionsCount: number;
  setConfirmDeleteList: (_: {
    id: StoryDistributionIdString;
    name: string;
  }) => unknown;
  setPage: (page: Page) => unknown;
  setSelectedContacts: (contacts: Array<ConversationType>) => unknown;
  theme: ThemeType;
  onBackButtonClick: (() => void) | undefined;
  onClose: () => void;
} & Pick<
  PropsType,
  | 'getPreferredBadge'
  | 'onRemoveMembers'
  | 'onRepliesNReactionsChanged'
  | 'setMyStoriesToAllSignalConnections'
  | 'toggleSignalConnectionsModal'
>;

export function DistributionListSettingsModal({
  getPreferredBadge,
  i18n,
  listToEdit,
  onRemoveMembers,
  onRepliesNReactionsChanged,
  onBackButtonClick,
  onClose,
  setConfirmDeleteList,
  setMyStoriesToAllSignalConnections,
  setPage,
  setSelectedContacts,
  theme,
  toggleSignalConnectionsModal,
  signalConnectionsCount,
}: DistributionListSettingsModalPropsType): JSX.Element {
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<
    | undefined
    | {
        listId: string;
        title: string;
        serviceId: ServiceIdString;
      }
  >();

  const isMyStory = listToEdit.id === MY_STORY_ID;

  const modalTitle = getStoryDistributionListName(
    i18n,
    listToEdit.id,
    listToEdit.name
  );

  return (
    <ModalPage
      modalName="DistributionListSettingsModal"
      i18n={i18n}
      onBackButtonClick={onBackButtonClick}
      onClose={onClose}
      title={modalTitle}
      {...modalCommonProps}
    >
      {!isMyStory && (
        <>
          <div className="StoriesSettingsModal__list StoriesSettingsModal__list--no-pointer">
            <span className="StoriesSettingsModal__list__left">
              <span className="StoriesSettingsModal__list__avatar--custom" />
              <span className="StoriesSettingsModal__list__title">
                <StoryDistributionListName
                  i18n={i18n}
                  id={listToEdit.id}
                  name={listToEdit.name}
                />
              </span>
            </span>
          </div>

          <hr className="StoriesSettingsModal__divider" />
        </>
      )}

      <div className="StoriesSettingsModal__title">
        {i18n('icu:StoriesSettings__who-can-see')}
      </div>

      {isMyStory && (
        <EditMyStoryPrivacy
          i18n={i18n}
          kind="mine"
          myStories={listToEdit}
          onClickExclude={() => {
            setPage(Page.HideStoryFrom);
          }}
          onClickOnlyShareWith={() => {
            setPage(Page.AddViewer);
          }}
          setSelectedContacts={setSelectedContacts}
          setMyStoriesToAllSignalConnections={
            setMyStoriesToAllSignalConnections
          }
          toggleSignalConnectionsModal={toggleSignalConnectionsModal}
          signalConnectionsCount={signalConnectionsCount}
        />
      )}

      {!isMyStory && (
        <>
          <button
            className="StoriesSettingsModal__list"
            onClick={() => {
              setSelectedContacts(listToEdit.members);
              setPage(Page.AddViewer);
            }}
            type="button"
          >
            <span className="StoriesSettingsModal__list__left">
              <span className="StoriesSettingsModal__list__avatar--new" />
              <span className="StoriesSettingsModal__list__title">
                {i18n('icu:StoriesSettings__add-viewer')}
              </span>
            </span>
          </button>

          {listToEdit.members.map(member => (
            <div
              className="StoriesSettingsModal__list StoriesSettingsModal__list--no-pointer"
              key={member.id}
            >
              <span className="StoriesSettingsModal__list__left">
                <Avatar
                  acceptedMessageRequest={member.acceptedMessageRequest}
                  avatarUrl={member.avatarUrl}
                  badge={getPreferredBadge(member.badges)}
                  color={member.color}
                  conversationType={member.type}
                  i18n={i18n}
                  isMe
                  sharedGroupNames={member.sharedGroupNames}
                  size={AvatarSize.THIRTY_TWO}
                  theme={theme}
                  title={member.title}
                />
                <span className="StoriesSettingsModal__list__title">
                  <UserText text={member.title} />
                </span>
              </span>

              <button
                aria-label={i18n('icu:StoriesSettings__remove--title', {
                  title: member.title,
                })}
                className="StoriesSettingsModal__list__delete"
                onClick={() => {
                  strictAssert(
                    member.serviceId,
                    'Story member was missing service id'
                  );
                  setConfirmRemoveMember({
                    listId: listToEdit.id,
                    title: member.title,
                    serviceId: member.serviceId,
                  });
                }}
                type="button"
              />
            </div>
          ))}
        </>
      )}

      <hr className="StoriesSettingsModal__divider" />

      <div className="StoriesSettingsModal__title">
        {i18n('icu:StoriesSettings__replies-reactions--title')}
      </div>

      <Checkbox
        checked={listToEdit.allowsReplies}
        description={i18n(
          'icu:StoriesSettings__replies-reactions--description'
        )}
        label={i18n('icu:StoriesSettings__replies-reactions--label')}
        moduleClassName="StoriesSettingsModal__checkbox"
        name="replies-reactions"
        onChange={value => onRepliesNReactionsChanged(listToEdit.id, value)}
      />

      {!isMyStory && (
        <>
          <hr className="StoriesSettingsModal__divider" />

          <button
            className="StoriesSettingsModal__delete-list"
            onClick={() => setConfirmDeleteList(listToEdit)}
            type="button"
          >
            {i18n('icu:StoriesSettings__delete-list')}
          </button>
        </>
      )}

      {confirmRemoveMember && (
        <ConfirmationDialog
          dialogName="StoriesSettings.confirmRemoveMember"
          actions={[
            {
              action: () =>
                onRemoveMembers(confirmRemoveMember.listId, [
                  confirmRemoveMember.serviceId,
                ]),
              style: 'negative',
              text: i18n('icu:StoriesSettings__remove--action'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setConfirmRemoveMember(undefined);
          }}
          title={i18n('icu:StoriesSettings__remove--title', {
            title: confirmRemoveMember.title,
          })}
        >
          {i18n('icu:StoriesSettings__remove--body')}
        </ConfirmationDialog>
      )}
    </ModalPage>
  );
}

type CheckboxRenderProps = {
  checkboxNode: ReactNode;
  labelNode: ReactNode;
  descriptionNode: ReactNode;
};

function CheckboxRender({
  checkboxNode,
  labelNode,
  descriptionNode,
}: CheckboxRenderProps) {
  return (
    <>
      {checkboxNode}
      <div className="StoriesSettingsModal__checkbox-container">
        <div className="StoriesSettingsModal__checkbox-label">{labelNode}</div>
        <div className="StoriesSettingsModal__checkbox-description">
          {descriptionNode}
        </div>
      </div>
    </>
  );
}

type EditMyStoryPrivacyPropsType = {
  hasDisclaimerAbove?: boolean;
  i18n: LocalizerType;
  kind: 'privacy' | 'mine';
  myStories: StoryDistributionListWithMembersDataType;
  onClickExclude: () => unknown;
  onClickOnlyShareWith: () => unknown;
  setSelectedContacts: (contacts: Array<ConversationType>) => unknown;
  signalConnectionsCount: number;
} & Pick<
  PropsType,
  'setMyStoriesToAllSignalConnections' | 'toggleSignalConnectionsModal'
>;

export function EditMyStoryPrivacy({
  hasDisclaimerAbove,
  i18n,
  kind,
  myStories,
  onClickExclude,
  onClickOnlyShareWith,
  setSelectedContacts,
  setMyStoriesToAllSignalConnections,
  toggleSignalConnectionsModal,
  signalConnectionsCount,
}: EditMyStoryPrivacyPropsType): JSX.Element {
  const learnMoreLink = (parts: Array<JSX.Element | string>) => (
    <button
      className="StoriesSettingsModal__disclaimer__learn-more"
      onClick={toggleSignalConnectionsModal}
      type="button"
    >
      {parts}
    </button>
  );
  const disclaimerElement = (
    <div className="StoriesSettingsModal__disclaimer">
      {kind === 'mine' ? (
        <I18n
          components={{ learnMoreLink }}
          i18n={i18n}
          id="icu:StoriesSettings__mine__disclaimer--link"
        />
      ) : (
        <I18n
          components={{ learnMoreLink }}
          i18n={i18n}
          id="icu:SendStoryModal__privacy-disclaimer--link"
        />
      )}
    </div>
  );

  return (
    <>
      {hasDisclaimerAbove && disclaimerElement}

      <Checkbox
        checked={myStories.isBlockList && !myStories.members.length}
        isRadio
        label={i18n('icu:StoriesSettings__mine__all--label')}
        moduleClassName="StoriesSettingsModal__checkbox"
        name="share"
        onChange={() => {
          setMyStoriesToAllSignalConnections();
        }}
      >
        {({ checkboxNode, labelNode, checked }) => {
          return (
            <CheckboxRender
              checkboxNode={checkboxNode}
              labelNode={labelNode}
              descriptionNode={
                checked && (
                  <>
                    {i18n('icu:StoriesSettings__viewers', {
                      count: signalConnectionsCount,
                    })}
                  </>
                )
              }
            />
          );
        }}
      </Checkbox>

      <Checkbox
        checked={myStories.isBlockList && myStories.members.length > 0}
        isRadio
        label={i18n('icu:StoriesSettings__mine__exclude--label')}
        moduleClassName="StoriesSettingsModal__checkbox"
        name="share"
        onChange={noop}
        onClick={() => {
          if (myStories.isBlockList) {
            setSelectedContacts(myStories.members);
          }
          onClickExclude();
        }}
      >
        {({ checkboxNode, labelNode, checked }) => {
          return (
            <CheckboxRender
              checkboxNode={checkboxNode}
              labelNode={labelNode}
              descriptionNode={
                checked && (
                  <>
                    {i18n('icu:StoriesSettings__viewers', {
                      count: myStories.members.length,
                    })}
                  </>
                )
              }
            />
          );
        }}
      </Checkbox>

      <Checkbox
        checked={!myStories.isBlockList && myStories.members.length > 0}
        isRadio
        label={i18n('icu:StoriesSettings__mine__only--label')}
        moduleClassName="StoriesSettingsModal__checkbox"
        name="share"
        onChange={noop}
        onClick={() => {
          if (!myStories.isBlockList) {
            setSelectedContacts(myStories.members);
          }
          onClickOnlyShareWith();
        }}
      >
        {({ checkboxNode, labelNode, checked }) => {
          return (
            <CheckboxRender
              checkboxNode={checkboxNode}
              labelNode={labelNode}
              descriptionNode={
                checked && (
                  <>
                    {i18n('icu:StoriesSettings__viewers', {
                      count: myStories.members.length,
                    })}
                  </>
                )
              }
            />
          );
        }}
      </Checkbox>

      {!hasDisclaimerAbove && disclaimerElement}
    </>
  );
}

type EditDistributionListModalPropsType = {
  onCreateList: (
    name: string,
    viewerServiceIds: Array<ServiceIdString>
  ) => unknown;
  onViewersUpdated: (viewerServiceIds: Array<ServiceIdString>) => unknown;
  page:
    | Page.AddViewer
    | Page.ChooseViewers
    | Page.HideStoryFrom
    | Page.NameStory;
  selectedContacts: Array<ConversationType>;
  onClose: () => unknown;
  setSelectedContacts: (contacts: Array<ConversationType>) => unknown;
  theme: ThemeType;
  onBackButtonClick: () => void;
} & Pick<PropsType, 'candidateConversations' | 'getPreferredBadge' | 'i18n'>;

export function EditDistributionListModal({
  candidateConversations,
  getPreferredBadge,
  i18n,
  onCreateList,
  onViewersUpdated,
  page,
  onClose,
  selectedContacts,
  setSelectedContacts,
  theme,
  onBackButtonClick,
}: EditDistributionListModalPropsType): JSX.Element {
  const [storyName, setStoryName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedSearchTerm = searchTerm.trim();

  const [filteredConversations, setFilteredConversations] = useState(
    filterConversations(candidateConversations, normalizedSearchTerm)
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredConversations(
        filterConversations(candidateConversations, normalizedSearchTerm)
      );
    }, 200);
    return () => {
      clearTimeout(timeout);
    };
  }, [candidateConversations, normalizedSearchTerm, setFilteredConversations]);

  const contactLookup = useMemo(() => {
    const map = new Map();
    candidateConversations.forEach(contact => {
      map.set(contact.id, contact);
    });
    return map;
  }, [candidateConversations]);

  const selectConversationServiceIds: Set<ServiceIdString> = useMemo(
    () =>
      new Set(
        selectedContacts.map(contact => contact.serviceId).filter(isNotNil)
      ),
    [selectedContacts]
  );

  const toggleSelectedConversation = useCallback(
    (conversationId: string) => {
      let removeContact = false;
      const nextSelectedContacts = selectedContacts.filter(contact => {
        if (contact.id === conversationId) {
          removeContact = true;
          return false;
        }
        return true;
      });
      if (removeContact) {
        setSelectedContacts(nextSelectedContacts);
        return;
      }
      const selectedContact = contactLookup.get(conversationId);
      if (selectedContact) {
        setSelectedContacts([...nextSelectedContacts, selectedContact]);
      }
    },
    [contactLookup, selectedContacts, setSelectedContacts]
  );

  const isChoosingViewers =
    page === Page.ChooseViewers || page === Page.AddViewer;

  if (page === Page.NameStory) {
    const footer = (
      <Button
        disabled={!storyName}
        onClick={() => {
          onCreateList(storyName, Array.from(selectConversationServiceIds));
          setStoryName('');
        }}
        variant={ButtonVariant.Primary}
      >
        {i18n('icu:done')}
      </Button>
    );

    return (
      <ModalPage
        modalName="StoriesSettings__name-story"
        title={i18n('icu:StoriesSettings__name-story')}
        modalFooter={footer}
        i18n={i18n}
        onBackButtonClick={onBackButtonClick}
        onClose={onClose}
        {...modalCommonProps}
      >
        <Input
          i18n={i18n}
          onChange={setStoryName}
          placeholder={i18n('icu:StoriesSettings__name-placeholder')}
          moduleClassName="StoriesSettingsModal__input"
          value={storyName}
        />

        <div className="StoriesSettingsModal__visibility">
          {i18n('icu:SendStoryModal__new-custom--name-visibility')}
        </div>

        <div className="StoriesSettingsModal__title">
          {i18n('icu:StoriesSettings__who-can-see')}
        </div>

        {selectedContacts.map(contact => (
          <div
            className="StoriesSettingsModal__list StoriesSettingsModal__list--no-pointer"
            key={contact.id}
          >
            <span className="StoriesSettingsModal__list__left">
              <Avatar
                acceptedMessageRequest={contact.acceptedMessageRequest}
                avatarUrl={contact.avatarUrl}
                badge={getPreferredBadge(contact.badges)}
                color={contact.color}
                conversationType={contact.type}
                i18n={i18n}
                isMe
                sharedGroupNames={contact.sharedGroupNames}
                size={AvatarSize.THIRTY_TWO}
                theme={theme}
                title={contact.title}
              />
              <span className="StoriesSettingsModal__list__title">
                <UserText text={contact.title} />
              </span>
            </span>
          </div>
        ))}
      </ModalPage>
    );
  }

  const rowCount = filteredConversations.length;
  const getRow = (index: number): undefined | Row => {
    const contact = filteredConversations[index];
    if (!contact || !contact.serviceId) {
      return undefined;
    }

    const isSelected = selectConversationServiceIds.has(contact.serviceId);

    return {
      type: RowType.ContactCheckbox,
      contact,
      isChecked: isSelected,
    };
  };

  let footer: JSX.Element | undefined;
  if (isChoosingViewers) {
    footer = (
      <Button
        disabled={selectedContacts.length === 0}
        onClick={() => {
          onViewersUpdated(Array.from(selectConversationServiceIds));
        }}
        variant={ButtonVariant.Primary}
      >
        {page === Page.AddViewer ? i18n('icu:done') : i18n('icu:next2')}
      </Button>
    );
  } else if (page === Page.HideStoryFrom) {
    footer = (
      <Button
        disabled={selectedContacts.length === 0}
        onClick={() => {
          onViewersUpdated(Array.from(selectConversationServiceIds));
        }}
        variant={ButtonVariant.Primary}
      >
        {i18n('icu:update')}
      </Button>
    );
  }

  return (
    <ModalPage
      modalName={`EditDistributionListModal__${page}`}
      i18n={i18n}
      modalFooter={footer}
      onBackButtonClick={onBackButtonClick}
      onClose={onClose}
      title={
        page === Page.HideStoryFrom
          ? i18n('icu:StoriesSettings__hide-story')
          : i18n('icu:StoriesSettings__choose-viewers')
      }
      padded={page !== Page.ChooseViewers && page !== Page.AddViewer}
      {...modalCommonProps}
    >
      <SearchInput
        disabled={candidateConversations.length === 0}
        i18n={i18n}
        placeholder={i18n('icu:contactSearchPlaceholder')}
        moduleClassName="StoriesSettingsModal__search"
        onChange={event => {
          setSearchTerm(event.target.value);
        }}
        value={searchTerm}
      />

      {selectedContacts.length ? (
        <ContactPills moduleClassName="StoriesSettingsModal__tags">
          {selectedContacts.map(contact => (
            <ContactPill
              key={contact.id}
              acceptedMessageRequest={contact.acceptedMessageRequest}
              avatarUrl={contact.avatarUrl}
              color={contact.color}
              firstName={contact.firstName}
              i18n={i18n}
              id={contact.id}
              isMe={contact.isMe}
              phoneNumber={contact.phoneNumber}
              profileName={contact.profileName}
              sharedGroupNames={contact.sharedGroupNames}
              title={contact.title}
              onClickRemove={() => toggleSelectedConversation(contact.id)}
            />
          ))}
        </ContactPills>
      ) : undefined}
      {candidateConversations.length ? (
        <SizeObserver>
          {(ref, size) => (
            <div className="StoriesSettingsModal__conversation-list" ref={ref}>
              <ConversationList
                dimensions={size ?? undefined}
                getPreferredBadge={getPreferredBadge}
                getRow={getRow}
                i18n={i18n}
                lookupConversationWithoutServiceId={asyncShouldNeverBeCalled}
                onClickArchiveButton={shouldNeverBeCalled}
                onClickClearFilterButton={shouldNeverBeCalled}
                onClickContactCheckbox={(conversationId: string) => {
                  toggleSelectedConversation(conversationId);
                }}
                onPreloadConversation={shouldNeverBeCalled}
                onSelectConversation={shouldNeverBeCalled}
                blockConversation={shouldNeverBeCalled}
                removeConversation={shouldNeverBeCalled}
                onOutgoingAudioCallInConversation={shouldNeverBeCalled}
                onOutgoingVideoCallInConversation={shouldNeverBeCalled}
                renderMessageSearchResult={() => {
                  shouldNeverBeCalled();
                  return <div />;
                }}
                rowCount={rowCount}
                setIsFetchingUUID={shouldNeverBeCalled}
                shouldRecomputeRowHeights={false}
                showChooseGroupMembers={shouldNeverBeCalled}
                showFindByUsername={shouldNeverBeCalled}
                showFindByPhoneNumber={shouldNeverBeCalled}
                showConversation={shouldNeverBeCalled}
                showUserNotFoundModal={shouldNeverBeCalled}
                theme={theme}
              />
            </div>
          )}
        </SizeObserver>
      ) : (
        <div className="module-ForwardMessageModal__no-candidate-contacts">
          {i18n('icu:noContactsFound')}
        </div>
      )}
    </ModalPage>
  );
}

type GroupStorySettingsModalProps = {
  i18n: LocalizerType;
  group: ConversationType;
  onClose(): void;
  onBackButtonClick(): void;
  getConversationByServiceId(
    serviceId: ServiceIdString
  ): ConversationType | undefined;
  onRemoveGroup(group: ConversationType): void;
};

export function GroupStorySettingsModal({
  i18n,
  group,
  onClose,
  onBackButtonClick,
  getConversationByServiceId,
  onRemoveGroup,
}: GroupStorySettingsModalProps): JSX.Element {
  const groupMemberships = getGroupMemberships(
    group,
    getConversationByServiceId
  );
  return (
    <ModalPage
      modalName="GroupStorySettingsModal"
      i18n={i18n}
      onClose={onClose}
      onBackButtonClick={onBackButtonClick}
      title={group.title}
      {...modalCommonProps}
    >
      <div className="GroupStorySettingsModal__header">
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
        <span className="GroupStorySettingsModal__title">
          <UserText text={group.title} />
        </span>
      </div>

      <hr className="StoriesSettingsModal__divider" />

      <p className="GroupStorySettingsModal__members_title">
        {i18n('icu:GroupStorySettingsModal__members_title')}
      </p>
      {groupMemberships.memberships.map(membership => {
        const { member } = membership;
        return (
          <div
            key={member.id}
            className="GroupStorySettingsModal__members_item"
          >
            <Avatar
              acceptedMessageRequest={member.acceptedMessageRequest}
              avatarUrl={member.avatarUrl}
              badge={undefined}
              color={member.color}
              conversationType={member.type}
              i18n={i18n}
              isMe={false}
              sharedGroupNames={[]}
              size={AvatarSize.THIRTY_TWO}
              title={member.title}
            />
            <p className="GroupStorySettingsModal__members_item__name">
              <UserText text={member.title} />
            </p>
          </div>
        );
      })}

      <p className="GroupStorySettingsModal__members_help">
        {i18n('icu:GroupStorySettingsModal__members_help', {
          groupTitle: group.title,
        })}
      </p>

      <hr className="StoriesSettingsModal__divider" />

      <button
        className="GroupStorySettingsModal__remove_group"
        onClick={() => onRemoveGroup(group)}
        type="button"
      >
        {i18n('icu:GroupStorySettingsModal__remove_group')}
      </button>
    </ModalPage>
  );
}
