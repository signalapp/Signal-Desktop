import { createSelector } from 'reselect';
import { StagedAttachmentType } from '../../components/conversation/composition/CompositionBox';
import { StagedAttachmentsStateType } from '../ducks/stagedAttachments';
import { StateType } from '../reducer';
import { getSelectedConversationKey } from './conversations';

export const getStagedAttachmentsState = (state: StateType): StagedAttachmentsStateType =>
  state.stagedAttachments;

const getStagedAttachmentsForConversation = (
  state: StagedAttachmentsStateType,
  conversationKey: string | undefined
) => {
  if (!conversationKey) {
    return undefined;
  }
  return state.stagedAttachments[conversationKey] || [];
};

export const getStagedAttachmentsForCurrentConversation = createSelector(
  [getSelectedConversationKey, getStagedAttachmentsState],
  (
    selectedConversationKey: string | undefined,
    state: StagedAttachmentsStateType
  ): Array<StagedAttachmentType> | undefined => {
    return getStagedAttachmentsForConversation(state, selectedConversationKey);
  }
);
