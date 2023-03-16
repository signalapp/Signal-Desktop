import { isEmpty, isNil } from 'lodash';
import { SogsRoomInfoState } from '../ducks/sogsRoomInfo';
import { StateType } from '../reducer';

const getSogsRoomInfoState = (state: StateType): SogsRoomInfoState => state.sogsRoomInfo;

export function getCanWrite(state: StateType, selectedConvo?: string): boolean {
  if (!selectedConvo) {
    return false;
  }

  const canWrite = getSogsRoomInfoState(state).rooms[selectedConvo]?.canWrite;
  // if there is no entry in the redux slice, consider it true (as this selector will be hit for non sogs convo too)
  return isNil(canWrite) ? true : canWrite;
}

export function getSubscriberCount(state: StateType, selectedConvo?: string): number {
  if (!selectedConvo) {
    return 0;
  }

  const subscriberCount = getSogsRoomInfoState(state).rooms[selectedConvo]?.subscriberCount;
  // if there is no entry in the redux slice, consider it 0 (as this selector will be hit for non sogs convo too)
  return isNil(subscriberCount) ? 0 : subscriberCount;
}

export function getModerators(state: StateType, selectedConvo?: string): Array<string> {
  if (!selectedConvo) {
    return [];
  }

  const moderators = getSogsRoomInfoState(state).rooms[selectedConvo]?.moderators;

  return isEmpty(moderators) ? [] : moderators;
}

export function getSubscriberCountOutsideRedux(convoId: string): number {
  const state = window.inboxStore?.getState();

  return state ? getSubscriberCount(state, convoId) : 0;
}

export function getCanWriteOutsideRedux(convoId: string): boolean {
  const state = window.inboxStore?.getState();
  return state ? getCanWrite(state, convoId) : false;
}

export function getModeratorsOutsideRedux(convoId: string): Array<string> {
  const state = window.inboxStore?.getState();
  return state ? getModerators(state, convoId) : [];
}

export const getCurrentSubscriberCountOutsideRedux = (convoId?: string): number | undefined => {
  const state = window.inboxStore?.getState();
  return getSubscriberCount(state, convoId);
};
