import { nodeResolve } from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import { rollupPluginHTML as html } from '@web/rollup-plugin-html';
import dotenv from 'dotenv';
import esbuildPlugin from 'rollup-plugin-esbuild';

dotenv.config();

const firebaseDisabled = process.env.FIREBASE_CONFIG_DISABLED === '1';
const firebaseValue = name =>
  JSON.stringify(firebaseDisabled ? '' : (process.env[name] ?? ''));

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
    html({ minify: true, publicPath: '/' }),
  ],
};
