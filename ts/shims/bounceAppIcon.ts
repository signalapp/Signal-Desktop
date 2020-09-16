import { ipcRenderer } from 'electron';

export function bounceAppIconStart(isCritical = false): void {
  ipcRenderer.send('bounce-app-icon-start', isCritical);
}

export function bounceAppIconStop(): void {
  ipcRenderer.send('bounce-app-icon-stop');
}
