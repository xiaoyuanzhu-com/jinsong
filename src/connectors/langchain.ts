import type { Connector } from './types.js';

export const connector: Connector = {
  name: 'langchain',
  detect: () => false, // TODO: detect LangChain/LangSmith trace format
  convert: () => { throw new Error('LangChain connector not yet implemented'); },
};
