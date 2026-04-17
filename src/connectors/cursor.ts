import type { Connector } from './types.js';

export const connector: Connector = {
  name: 'cursor',
  detect: () => false, // TODO: detect Cursor IDE session files
  convert: () => { throw new Error('Cursor connector not yet implemented'); },
};
