function createTemplate(options, messages) {
  const {
    showDebugLog,
    showAbout,
    openReleaseNotes,
    openNewBugForm,
    openSupportPage,
    openForums,
  } = options;

  const template = [{
    label: messages.mainMenuFile.message,
    submenu: [
      {
        role: 'quit',
      },
    ],
  },
  {
    label: messages.mainMenuEdit.message,
    submenu: [
      {
        role: 'undo',
      },
      {
        role: 'redo',
      },
      {
        type: 'separator',
      },
      {
        role: 'cut',
      },
      {
        role: 'copy',
      },
      {
        role: 'paste',
      },
      {
        role: 'pasteandmatchstyle',
      },
      {
        role: 'delete',
      },
      {
        role: 'selectall',
      },
    ],
  },
  {
    label: messages.mainMenuView.message,
    submenu: [
      {
        role: 'resetzoom',
      },
      {
        role: 'zoomin',
      },
      {
        role: 'zoomout',
      },
      {
        type: 'separator',
      },
      {
        role: 'togglefullscreen',
      },
      {
        type: 'separator',
      },
      {
        label: messages.debugLog.message,
        click: showDebugLog,
      },
      {
        type: 'separator',
      },
      {
        role: 'toggledevtools',
      },
    ],
  },
  {
    label: messages.mainMenuWindow.message,
    role: 'window',
    submenu: [
      {
        role: 'minimize',
      },
    ],
  },
  {
    label: messages.mainMenuHelp.message,
    role: 'help',
    submenu: [
      {
        label: messages.goToReleaseNotes.message,
        click: openReleaseNotes,
      },
      {
        type: 'separator',
      },
      {
        label: messages.goToForums.message,
        click: openForums,
      },
      {
        label: messages.goToSupportPage.message,
        click: openSupportPage,
      },
      {
        label: messages.fileABug.message,
        click: openNewBugForm,
      },
      {
        type: 'separator',
      },
      {
        label: messages.aboutSignalDesktop.message,
        click: showAbout,
      },
    ],
  }];

  if (process.platform === 'darwin') {
    return updateForMac(template, messages, options);
  }

  return template;
}

function updateForMac(template, messages, options) {
  const {
    showWindow,
    showAbout,
  } = options;

  // Remove About item and separator from Help menu, since it's on the first menu
  template[4].submenu.pop();
  template[4].submenu.pop();

  // Replace File menu
  template.shift();
  template.unshift({
    submenu: [
      {
        label: messages.aboutSignalDesktop.message,
        click: showAbout,
      },
      {
        type: 'separator',
      },
      {
        role: 'hide',
      },
      {
        role: 'hideothers',
      },
      {
        role: 'unhide',
      },
      {
        type: 'separator',
      },
      {
        role: 'quit',
      },
    ],
  });

  // Add to Edit menu
  template[1].submenu.push(
    {
      type: 'separator',
    },
    {
      label: messages.speech.message,
      submenu: [
        {
          role: 'startspeaking',
        },
        {
          role: 'stopspeaking',
        },
      ],
    },
  );

  // Replace Window menu
  // eslint-disable-next-line no-param-reassign
  template[3].submenu = [
    {
      accelerator: 'CmdOrCtrl+W',
      role: 'close',
    },
    {
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize',
    },
    {
      role: 'zoom',
    },
    {
      label: messages.show.message,
      click: showWindow,
    },
    {
      type: 'separator',
    },
    {
      role: 'front',
    },
  ];

  return template;
}

module.exports = createTemplate;
