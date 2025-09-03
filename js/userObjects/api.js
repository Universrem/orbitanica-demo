'use strict';

import { list, add, remove, onChange, exportAll, importAll, getByName } from './store.local.js';

export function getStore() {
  return { list, add, remove, onChange, exportAll, importAll, getByName };
}
