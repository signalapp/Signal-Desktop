import { ipcRenderer } from 'electron';

export function startUpdate() {
  ipcRenderer.send('start-update');
}

export function ackRender() {
  ipcRenderer.send('show-update-dialog-ack');
}
