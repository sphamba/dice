import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ command, mode }) => ({
  base: './',
  plugins: command === 'serve' && mode !== 'test' ? [basicSsl()] : [],
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
}));
