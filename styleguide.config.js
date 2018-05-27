const webpack = require('webpack');
const path = require('path');
const typescriptSupport = require('react-docgen-typescript');

const propsParser = typescriptSupport.withCustomConfig('./tsconfig.json').parse;

module.exports = {
  sections: [
    {
      name: 'Components',
      description: '',
      components: 'ts/components/*.tsx',
    },
    {
      name: 'Conversation',
      description: 'Everything necessary to render a conversation',
      components: 'ts/components/conversation/*.tsx',
    },
    {
      name: 'Media Gallery',
      description: 'Display media and documents in a conversation',
      components: 'ts/components/conversation/media-gallery/*.tsx',
    },
    {
      name: 'Utility',
      description: 'Utility components used across the application',
      components: 'ts/components/utility/*.tsx',
    },
    {
      name: 'Test',
      description: 'Components only used for testing',
      components: 'ts/styleguide/**/*.tsx',
    },
  ],
  context: {
    // Exposes necessary utilities in the global scope for all readme code snippets
    util: 'ts/styleguide/StyleGuideUtil',
  },
  contextDependencies: [path.join(__dirname, 'ts/styleguide')],
  // We don't want one long, single page
  pagePerSection: true,
  // Expose entire repository to the styleguidist server, primarily for stylesheets
  assetsDir: './',
  // Add top-level elements to the HTML:
  //   docs: https://github.com/vxna/mini-html-webpack-template
  //   https://react-styleguidist.js.org/docs/configuration.html#template
  template: {
    head: {
      links: [
        {
          rel: 'stylesheet',
          type: 'text/css',
          href: '/stylesheets/manifest.css',
        },
      ],
    },
    body: {
      // Brings in all the necessary components to boostrap Backbone views
      // Mirrors the order used in background.js.
      scripts: [
        {
          src: 'test/styleguide/legacy_bridge.js',
        },
        {
          src: 'node_modules/moment/min/moment-with-locales.min.js',
        },
        {
          src: 'js/components.js',
        },
        {
          src: 'js/reliable_trigger.js',
        },
        {
          src: 'js/database.js',
        },
        {
          src: 'js/storage.js',
        },
        {
          src: 'js/signal_protocol_store.js',
        },
        {
          src: 'js/libtextsecure.js',
        },
        {
          src: 'js/focus_listener.js',
        },
        {
          src: 'js/notifications.js',
        },
        {
          src: 'js/delivery_receipts.js',
        },
        {
          src: 'js/read_receipts.js',
        },
        {
          src: 'js/read_syncs.js',
        },
        {
          src: 'js/libphonenumber-util.js',
        },
        {
          src: 'js/models/messages.js',
        },
        {
          src: 'js/models/conversations.js',
        },
        {
          src: 'js/models/blockedNumbers.js',
        },
        {
          src: 'js/expiring_messages.js',
        },
        {
          src: 'js/chromium.js',
        },
        {
          src: 'js/registration.js',
        },
        {
          src: 'js/expire.js',
        },
        {
          src: 'js/conversation_controller.js',
        },
        // Select Backbone views
        {
          src: 'js/views/react_wrapper_view.js',
        },
        {
          src: 'js/views/whisper_view.js',
        },
        {
          src: 'js/views/timestamp_view.js',
        },
        {
          src: 'js/views/attachment_view.js',
        },
        {
          src: 'js/views/message_view.js',
        },
        // Hacky way of including templates for Backbone components
        {
          src: 'test/styleguide/legacy_templates.js',
        },
      ],
    },
  },
  propsParser,
  webpackConfig: {
    devtool: 'source-map',

    resolve: {
      // Necessary to enable the absolute path used in the context option above
      modules: [__dirname, path.join(__dirname, 'node_modules')],
      extensions: ['.tsx'],
    },

    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: 'ts-loader',
        },
        {
          // To test handling of attachments, we need arraybuffers in memory
          test: /\.(gif|mp3|mp4|txt|jpg|jpeg|png)$/,
          loader: 'arraybuffer-loader',
        },
      ],
    },
  },
};
