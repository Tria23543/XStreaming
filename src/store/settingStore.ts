import {storage} from './mmkv';
import {debugFactory} from '../utils/debug';
const log = debugFactory('settingStore');

const STORE_KEY = 'user.settings';

type DisplayOptions = {
  sharpness: number;
  saturation: number;
  contrast: number;
  brightness: number;
};

export type Settings = {
  locale: string;
  resolution: number;
  xhome_bitrate_mode: string;
  xhome_bitrate: number | string;
  xcloud_bitrate_mode: string;
  xcloud_bitrate: number | string;
  audio_bitrate_mode: string;
  audio_bitrate: number | string;
  preferred_game_language: string;
  force_region_ip: string;
  signaling_home: string;
  signaling_cloud: string;
  codec: string;
  show_performance: boolean;
  performance_style: boolean;
  vibration: boolean;
  vibration_mode: string;
  rumble_intensity: number;
  gamepad_kernal: string;
  dead_zone: number;
  edge_compensation: number;
  video_format: string;
  show_virtual_gamead: boolean;
  virtual_gamepad_opacity: number;
  custom_virtual_gamepad: string;
  display_options: DisplayOptions;
  ipv6: boolean;
  power_on: boolean;
  theme: string;
};

const defaultSettings: Settings = {
  locale: 'en',
  resolution: 720,
  xhome_bitrate_mode: 'auto',
  xhome_bitrate: 20,
  xcloud_bitrate_mode: 'auto',
  xcloud_bitrate: 20,
  audio_bitrate_mode: 'auto',
  audio_bitrate: 20,
  preferred_game_language: 'en-US',
  force_region_ip: '168.126.63.1',
  signaling_home: '',
  signaling_cloud: '',
  codec: '',
  show_performance: true,
  performance_style: true,
  vibration: true,
  vibration_mode: 'Native',
  rumble_intensity: 3,
  gamepad_kernal: 'Native',
  dead_zone: 0.1,
  edge_compensation: 0,
  video_format: '',
  show_virtual_gamead: true,
  virtual_gamepad_opacity: 0.6,
  custom_virtual_gamepad: '',
  ipv6: false,
  power_on: false,
  display_options: {
    sharpness: 5,
    saturation: 100,
    contrast: 100,
    brightness: 100,
  },
  theme: 'dark',
};

export const saveSettings = (settings: Settings) => {
  log.info('SaveSettings:', settings);
  const totalSettings = Object.assign({}, defaultSettings, settings);
  // AsyncStorage.setItem(STORE_KEY, JSON.stringify(totalSettings));
  storage.set(STORE_KEY, JSON.stringify(totalSettings));
};

export const getSettings = (): Settings => {
  let settings = storage.getString(STORE_KEY);
  if (!settings) {
    // A copy, never the shared object itself (the nested
    // display_options copied too): a caller mutating the returned
    // object must not corrupt the defaults for the whole session.
    // This is the same rule gamepadStore's getSettings follows.
    return {
      ...defaultSettings,
      display_options: {...defaultSettings.display_options},
    };
  }
  try {
    const _settings = JSON.parse(settings) as Settings;
    const merged = Object.assign({}, defaultSettings, _settings);
    // Object.assign is shallow: a partial stored display_options
    // (older version, partial save) would replace the whole object
    // and hand every reader undefined fields. Merge it over the
    // defaults instead.
    merged.display_options = {
      ...defaultSettings.display_options,
      ...(_settings.display_options || {}),
    };
    return merged;
  } catch {
    return {
      ...defaultSettings,
      display_options: {...defaultSettings.display_options},
    };
  }
};
