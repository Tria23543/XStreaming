import i18next from '../../i18n';

const {t} = i18next;

const gamepad = [
  {
    name: 'gamepad_kernal',
    type: 'radio',
    title: t('Gamepad kernel'),
    description: t(
      'Select gamepad kernel; you cannot use the virtual gamepad in the Web kernel',
    ),
    data: [
      {value: 'Native', text: 'Native'},
      {value: 'Web', text: 'Web'},
    ],
  },
  {
    name: 'vibration',
    type: 'radio',
    title: t('Vibration'),
    description: t(
      'If your controller supports vibration, you can set whether it vibrates during the game',
    ),
    data: [
      {value: true, text: t('Enable')},
      {value: false, text: t('Disable')},
    ],
  },
  {
    name: 'vibration_mode',
    type: 'radio',
    title: t('Vibration mode'),
    description: `${t('Native: Use native gamepad kernel to vibrate')}
${t("Device: Use Phone/Pad's vibrate")}`,
    data: [
      {value: 'Native', text: t('Native')},
      {value: 'Device', text: t('Device')},
    ],
  },
  {
    name: 'rumble_intensity',
    type: 'radio',
    title: t('Vibration intensity'),
    description: t('Config vibration intensity of controller'),
    data: [
      {value: 1, text: t('VeryWeak')},
      {value: 2, text: t('Weak')},
      {value: 3, text: t('Normal')},
      {value: 4, text: t('Strong')},
      {value: 5, text: t('VeryStrong')},
    ],
  },
  {
    name: 'dead_zone',
    type: 'slider',
    min: 0.1,
    max: 0.9,
    step: 0.01,
    title: t('Joystick dead zone'),
    description: t('Config joystick dead zone'),
    data: [],
  },
  {
    name: 'edge_compensation',
    type: 'slider',
    min: 0,
    max: 20,
    step: 1,
    title: t('Joystick edge compensation'),
    description: t(
      "If your joystick's maximum value doesn't reach the expected level, you can set maximum value compensation",
    ),
    data: [],
  },
  {
    name: 'show_virtual_gamead',
    type: 'radio',
    title: t('Virtual gamepad'),
    description: t('Always display the virtual gamepad'),
    data: [
      {value: true, text: t('Enable')},
      {value: false, text: t('Disable')},
    ],
  },
  {
    name: 'virtual_gamepad_opacity',
    type: 'slider',
    min: 0.1,
    max: 1,
    step: 0.1,
    title: t('Virtual Opacity'),
    description: t('Config opacity of virtual gamepad'),
    data: [],
  },
];

export default gamepad;
