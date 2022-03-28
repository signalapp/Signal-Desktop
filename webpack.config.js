const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = [
  //   {
  //     // bundling mode

  //     mode: 'development', //   mode: 'production',

  //     // entry files

  //     entry: './main.js',
  //     target: 'electron-main',
  //     module: {
  //       // loaders

  //       rules: [
  //         {
  //           test: /\.tsx?$/,
  //           include: /ts/,
  //           use: [{ loader: 'ts-loader' }],
  //           exclude: /node_modules/,
  //         },
  //       ],
  //     },
  //     // output bundles (location)

  //     output: {
  //       path: path.resolve(__dirname, 'dist'),
  //       filename: 'electron.js',
  //     },
  //   },

  {
    mode: 'development',
    entry: './ts/mains/main_renderer.ts',
    target: 'electron-renderer',
    devtool: 'source-map',
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.ts(x?)$/,
          include: [path.resolve(__dirname, 'ts'), path.resolve(__dirname, 'js')],
          use: [{ loader: 'ts-loader' }],
        },
      ],
    },
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
