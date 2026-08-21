import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';

const dev = process.env.ROLLUP_WATCH;

const plugins = [
  nodeResolve({}),
  commonjs(),
  json(),
  babel({
    exclude: 'node_modules/**',
    babelHelpers: 'bundled',
    babelrc: false,
  }),
  !dev &&
  terser({
    format: {
      comments: false,
    },
    mangle: {
      safari10: true,
    },
  }),
];

export default [
  {
    input: 'src/reolink-gallery-card.js',
    output: {
      dir: './dist',
      format: 'es',
      sourcemap: dev ? true : false,
    },
    plugins: [...plugins],
    watch: {
      exclude: 'node_modules/**',
    },
  },
];