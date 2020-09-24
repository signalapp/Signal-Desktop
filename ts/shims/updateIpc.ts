import { ipcRenderer } from 'electron';

export function startUpdate(): void {
  ipcRenderer.send('start-update');
}

export function ackRender(): void {
  ipcRenderer.send('show-update-dialog-ack');
}
