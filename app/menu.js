function createTemplate(options) {
  const showDebugLog = options.showDebugLog;
  const showWindow = options.showWindow;
  const showAbout = options.showAbout;

  let template = [{
    label: 'File',
    submenu: [
      {
        role: 'quit',
      },
    ]
  },
  {
    label: 'Edit',
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
      }
    ]
  },
  {
    label: 'View',
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
        label: 'Debug Log',
        click: showDebugLog,
      },
      {
        type: 'separator',
      },
      {
        role: 'toggledevtools',
      },
    ]
  },
  {
    role: 'window',
    submenu: [
      {
        role: 'minimize',
      },
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'about',
        click: showAbout,
      },
    ]
  }];

  if (process.platform !== 'darwin') {
    return template;
  }

  // Remove Help menu
  template.pop();

  // Replace File menu
  template.shift();
  template.unshift({
    submenu: [
      {
        label: 'about',
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
    ]
  });

  // Add to Edit menu
  template[1].submenu.push(
    {
      type: 'separator'
    },
    {
      label: 'Speech',
      submenu: [
        {
          role: 'startspeaking',
        },
        {
          role: 'stopspeaking',
        },
      ]
    }
  );

  // Add to Window menu
  template[3].submenu = [
    {
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      role: 'close',
    },
    {
      label: 'Minimize',
      accelerator: 'CmdOrCtrl+M',
      role: 'minimize',
    },
    {
      label: 'Zoom',
      role: 'zoom',
    },
    {
      label: 'Show',
      click: showWindow,
    },
    {
      type: 'separator',
    },
    {
      label: 'Bring All to Front',
      role: 'front',
    },
  ];

  return template;
}

module.exports = createTemplate;
