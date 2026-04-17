import type { Connector } from './types.js';

export const connector: Connector = {
  name: 'chatgpt',
  detect: () => false, // TODO: detect ChatGPT export format
  convert: () => { throw new Error('ChatGPT connector not yet implemented'); },
  discover: () => [],
};
