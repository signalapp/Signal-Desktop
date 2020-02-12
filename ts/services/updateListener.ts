import { ipcRenderer } from 'electron';
import { Dialogs } from '../types/Dialogs';
import { ShowUpdateDialogAction } from '../state/ducks/updates';

type UpdatesActions = {
  showUpdateDialog: (x: Dialogs) => ShowUpdateDialogAction;
};

export function initializeUpdateListener(updatesActions: UpdatesActions) {
  ipcRenderer.on('show-update-dialog', (_, dialogType: Dialogs) => {
    updatesActions.showUpdateDialog(dialogType);
  });
}
