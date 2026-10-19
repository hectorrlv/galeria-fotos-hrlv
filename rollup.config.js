import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { rollupPluginHTML as html } from '@web/rollup-plugin-html';
import dotenv from 'dotenv';
import esbuildPlugin from 'rollup-plugin-esbuild';
import { readFileSync } from 'node:fs';

dotenv.config();

const firebaseDisabled = process.env.FIREBASE_CONFIG_DISABLED === '1';
const emulatorsEnabled = process.env.FIREBASE_EMULATORS_ENABLED === '1';
const emulatorConfig = {
  FIREBASE_API_KEY: 'demo-gallery-likes-key',
  FIREBASE_AUTH_DOMAIN: 'demo-gallery-likes.firebaseapp.com',
  FIREBASE_DATABASE_URL:
    'https://demo-gallery-likes-default-rtdb.firebaseio.com',
  FIREBASE_PROJECT_ID: 'demo-gallery-likes',
  FIREBASE_STORAGE_BUCKET: 'demo-gallery-likes.appspot.com',
  FIREBASE_APP_ID: 'demo-gallery-likes-app',
};
const firebaseValue = name =>
  JSON.stringify(
    emulatorsEnabled
      ? (emulatorConfig[name] ?? '')
      : firebaseDisabled
        ? ''
        : (process.env[name] ?? ''),
  );

const logoAsset = () => ({
  name: 'logo-asset',
  buildStart() {
    this.emitFile({
      type: 'asset',
      fileName: 'logo.png',
      source: readFileSync('src/images/logo.png'),
    });
  },
});

export default {
  input: 'index.html',
  output: {
    dir: 'dist',
    sourcemap: true,
  },
  plugins: [
    replace({
      preventAssignment: true,
      values: {
        __FIREBASE_EMULATORS_ENABLED__: JSON.stringify(emulatorsEnabled),
        __FIREBASE_API_KEY__: firebaseValue('FIREBASE_API_KEY'),
        __FIREBASE_AUTH_DOMAIN__: firebaseValue('FIREBASE_AUTH_DOMAIN'),
        __FIREBASE_DATABASE_URL__: firebaseValue('FIREBASE_DATABASE_URL'),
        __FIREBASE_PROJECT_ID__: firebaseValue('FIREBASE_PROJECT_ID'),
        __FIREBASE_STORAGE_BUCKET__: firebaseValue('FIREBASE_STORAGE_BUCKET'),
        __FIREBASE_MESSAGING_SENDER_ID__: firebaseValue(
          'FIREBASE_MESSAGING_SENDER_ID',
        ),
        __FIREBASE_APP_ID__: firebaseValue('FIREBASE_APP_ID'),
        __FIREBASE_MEASUREMENT_ID__: firebaseValue('FIREBASE_MEASUREMENT_ID'),
      },
    }),
    nodeResolve({ browser: true }),
    esbuildPlugin({ target: 'es2022' }),
    logoAsset(),
    html({ minify: true, publicPath: '/', externalAssets: ['/logo.png'] }),
  ],
};
