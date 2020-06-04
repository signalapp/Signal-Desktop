import { ipcRenderer } from 'electron';

export function bounceAppIconStart(isCritical = false) {
  ipcRenderer.send('bounce-app-icon-start', isCritical);
}

export function bounceAppIconStop() {
  ipcRenderer.send('bounce-app-icon-stop');
}
