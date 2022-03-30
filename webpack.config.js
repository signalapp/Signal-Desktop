/* eslint-disable class-methods-use-this */
const path = require('path');
const { Compilation } = require('webpack');

const HtmlWebpackPlugin = require('html-webpack-plugin');

const optimization = {
  nodeEnv: false,
  removeAvailableModules: true,
  removeEmptyChunks: true,
  providedExports: true,
  minimize: false,
  // minimizer: [new TerserPlugin({ parallel: true })],
  // splitChunks: true,
};

module.exports = [
  {
    // bundling mode

    mode: 'development', //   mode: 'production',
    devtool: false,

    optimization,

    // entry files
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json'],
      // alias: {
      //   'better_sqlite3.node': path.resolve(__dirname),
      // },
    },
    entry: './ts/mains/main_node.ts',
    target: 'electron-main',
    module: {
      // loaders

      rules: [
        {
          test: /\.js$/,
          loader: `node-bindings-loader`,
        },
        {
          test: /\.node$/,
          loader: `node-loader`,
        },
        {
          test: /\.tsx?$/,
          include: /ts/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                experimentalWatchApi: true,
              },
            },
          ],
          exclude: /node_modules/,
        },
      ],
    },
    // output bundles (location)

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'electron_main.js',
    },
  },

  {
    mode: 'development',
    entry: './ts/mains/main_renderer.ts',
    target: 'electron-renderer',
    devtool: false,
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          include: [path.resolve(__dirname, 'ts'), path.resolve(__dirname, 'js')],
          use: [
            {
              loader: 'ts-loader',
              options: {
                transpileOnly: true,
                experimentalWatchApi: true,
              },
            },
          ],
        },
      ],
    },
    optimization,
    output: {
      path: path.resolve(__dirname, 'dist', 'js'),
      filename: 'electron-renderer.js',
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './background.html',
      }),
    ],
  },
];
