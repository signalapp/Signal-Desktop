import { ipcRenderer } from 'electron';
import { Dialogs } from '../types/Dialogs';
import { ShowUpdateDialogAction } from '../state/ducks/updates';

type UpdatesActions = {
  showUpdateDialog: (x: Dialogs) => ShowUpdateDialogAction;
};

type EventsType = {
  once: (ev: string, f: () => void) => void;
};

export function initializeUpdateListener(
  updatesActions: UpdatesActions,
  events: EventsType
): void {
  ipcRenderer.on('show-update-dialog', (_, dialogType: Dialogs) => {
    updatesActions.showUpdateDialog(dialogType);
  });

  events.once('snooze-update', () => {
    updatesActions.showUpdateDialog(Dialogs.Update);
  });
}
