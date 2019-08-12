const path = require('path');
// eslint-disable-next-line import/no-extraneous-dependencies
const typescriptSupport = require('react-docgen-typescript');

const propsParser = typescriptSupport.withCustomConfig('./tsconfig.json').parse;

module.exports = {
  sections: [
    {
      name: 'Components',
      description: '',
      components: 'ts/components/[^_]*.tsx',
    },
    {
      name: 'Conversation',
      description: 'Everything necessary to render a conversation',
      components: 'ts/components/conversation/[^_]*.tsx',
    },
    {
      name: 'Emoji',
      description: 'All components related to emojis',
      components: 'ts/components/emoji/[^_]*.tsx',
    },
    {
      name: 'Media Gallery',
      description: 'Display media and documents in a conversation',
      components: 'ts/components/conversation/media-gallery/[^_]*.tsx',
    },
    {
      name: 'Stickers',
      description: 'All components related to stickers',
      components: 'ts/components/stickers/[^_]*.tsx',
    },
    {
      name: 'Utility',
      description: 'Utility components used across the application',
      components: 'ts/components/utility/[^_]*.tsx',
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
        {
          rel: 'stylesheet',
          type: 'text/css',
          href: '/node_modules/draft-js/dist/Draft.css',
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
          test: /\.(gif|mp3|mp4|txt|jpg|jpeg|png|webp)$/,
          loader: 'arraybuffer-loader',
        },
      ],
    },
  },
};
