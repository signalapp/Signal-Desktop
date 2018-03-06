const addUnhandledErrorHandler = require('electron-unhandled');

const Errors = require('./types/errors');


//      addGlobalHandler :: Unit -> Unit
exports.addGlobalHandler = () => {
  addUnhandledErrorHandler({
    logger: (error) => {
      console.error(
        'Uncaught error or unhandled promise rejection:',
        Errors.toLogFormat(error)
      );
    },
    showDialog: false,
  });
};
