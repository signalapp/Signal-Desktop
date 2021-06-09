import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DefaultTheme } from 'styled-components';
import { SessionIconSize, SessionIconType } from '../../components/session/icon';
import { SessionButtonColor } from '../../components/session/SessionButton';


// import { OpenGroupV2InfoJoinable } from '../../opengroup/opengroupV2/ApiUtil';

// export type DefaultRoomsState = Array<OpenGroupV2InfoJoinable>;

// const initialState: DefaultRoomsState = [];

// /**
//  * Payload to dispatch to update the base64 data of a default room
//  */
// export type Base64Update = {
//   base64Data: string;
//   roomId: string;
// };

// /**
//  * This slice is the one holding the default joinable rooms fetched once in a while from the default opengroup v2 server.
//  */
// const defaultRoomsSlice = createSlice({
//   name: 'defaultRooms',
//   initialState,
//   reducers: {
//     updateDefaultRooms(state, action) {
//       window.log.warn('updating default rooms', action.payload);
//       return action.payload as DefaultRoomsState;
//     },
//     updateDefaultBase64RoomData(state, action: PayloadAction<Base64Update>) {
//       const payload = action.payload;
//       const newState = state.map(room => {
//         if (room.id === payload.roomId) {
//           return {
//             ...room,
//             base64Data: payload.base64Data,
//           };
//         }
//         return room;
//       });
//       return newState;
//     },
//   },
// });

// const { actions, reducer } = defaultRoomsSlice;
// export const { updateDefaultRooms, updateDefaultBase64RoomData } = actions;
// export const defaultRoomReducer = reducer;


export type ConfirmModalState = {
  message?: string;
  messageSub?: string;
  title?: string;
  onOk?: any;
  onClose?: any;
  onClickOk?: any;
  onClickClose?: any;
  okText?: string;
  cancelText?: string;
  hideCancel?: boolean;
  okTheme?: SessionButtonColor;
  closeTheme?: SessionButtonColor;
  sessionIcon?: SessionIconType;
  iconSize?: SessionIconSize;
  theme?: DefaultTheme;
} | null;

const initialState: ConfirmModalState = null;
// const initialState: any = { idk: 'hi'};

const confirmModalSlice = createSlice({
  name: 'confirmModal',
  initialState,
  reducers: {
    // updateConfirmModal(state, action: PayloadAction<ConfirmModalState>) {
    updateConfirmModal(state, action: any) {
      // return action.payload;

      // state.title = action.payload;
      state = action.payload;
      return action.payload;

      // state.confirmModal = action.payload;
    }
  }
})

const { actions, reducer } = confirmModalSlice;
export const { updateConfirmModal } = actions;
export const confirmModalReducer = reducer;