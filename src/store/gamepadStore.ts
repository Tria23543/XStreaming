import {storage} from './mmkv';
import {debugFactory} from '../utils/debug';
const log = debugFactory('gamepadStore');

const STORE_KEY = 'user.vgamepad';
// Stored JSON that parses to a scalar or an array is not a settings
// record: assigning named keys onto it throws in strict mode. Treat
// anything that is not a plain object as an empty record.
const asSettingsObject = (value: any): any => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value;
};


const defaultSettings: any = {};

export const saveSettings = (name: string, params: any) => {
  log.info('SaveSettings:', name, JSON.stringify(params));
  let settings: any = storage.getString(STORE_KEY);

  if (!settings) {
    settings = {};
  } else {
    try {
      settings = asSettingsObject(JSON.parse(settings));
    } catch (e) {
      settings = {};
    }
  }

  settings[name] = params;

  storage.set(STORE_KEY, JSON.stringify(settings));
};

export const deleteSetting = (name: string) => {
  log.info('deleteSetting:', name);
  let settings: any = storage.getString(STORE_KEY);

  if (!settings) {
    settings = {};
  } else {
    try {
      settings = asSettingsObject(JSON.parse(settings));
    } catch (e) {
      settings = {};
    }
  }

  delete settings[name];

  storage.set(STORE_KEY, JSON.stringify(settings));
};

export const getSettings = (): any => {
  let settings = storage.getString(STORE_KEY);
  if (!settings) {
    // A copy, never the shared object itself: several callers assign
    // into the returned settings before saving, and handing out the
    // module-level defaults would let one caller's writes silently
    // become every later caller's "defaults".
    return {...defaultSettings};
  }
  try {
    const _settings = JSON.parse(settings);
    if (!_settings || typeof _settings !== 'object' || Array.isArray(_settings)) {
      return {...defaultSettings};
    }
    return _settings;
  } catch {
    return {...defaultSettings};
  }
};
