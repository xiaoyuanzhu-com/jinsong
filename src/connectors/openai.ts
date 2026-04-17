import type { Connector } from './types.js';

export const connector: Connector = {
  name: 'openai',
  detect: () => false, // TODO: detect OpenAI API log format
  convert: () => { throw new Error('OpenAI connector not yet implemented'); },
};
