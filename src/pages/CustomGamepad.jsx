import React from 'react';
import Orientation from 'react-native-orientation-locker';
import {
  SafeAreaView,
  StyleSheet,
  NativeModules,
  Dimensions,
  View,
} from 'react-native';
import {
  Portal,
  Modal,
  Card,
  List,
  RadioButton,
  Text,
  Divider,
} from 'react-native-paper';
import {useTranslation} from 'react-i18next';
import Draggable from 'react-native-draggable';
import Slider from '@react-native-community/slider';
import GamepadButton from '../components/CustomGamepad/Button';
import {getSettings, saveSettings, deleteSetting} from '../store/gamepadStore';
import {
  getSettings as getUserSettings,
  saveSettings as saveUserSettings,
} from '../store/settingStore';
import {getDefaultButtons} from '../common/gamepadDefaults';

const {FullScreenManager} = NativeModules;

function CustomGamepadScreen({navigation, route}) {
  const {t} = useTranslation();
  const [settings, setSettings] = React.useState({});
  const [title, setTitle] = React.useState('');
  const [defaultButtons, setDefaultButtons] = React.useState([]);
  const [buttons, setButtons] = React.useState([]);
  const [showActionModal, setActionShowModal] = React.useState(false);
  const [showWarnModal, setShowWarnShowModal] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const [reloader, setReloader] = React.useState(Date.now());

  // False until the delayed initialisation has loaded the buttons:
  // before that, Save would persist an empty layout and Reset would
  // "restore" an empty defaults list.
  const [ready, setReady] = React.useState(false);
  const [currentButton, setCurrentButton] = React.useState('');
  const [currentScale, setCurrentScale] = React.useState(1);
  const [currentShow, setCurrentShow] = React.useState(true);

  React.useEffect(() => {
    const _settings = getSettings();
    let _title = '';
    setSettings(_settings);

    if (route.params?.name) {
      _title = route.params?.name;
      setTitle(route.params?.name);
    }

    // console.log('_settings:', _settings);
    FullScreenManager.immersiveModeOn();
    Orientation.lockToLandscape();
    const initTimer = setTimeout(() => {
      const {width, height} = Dimensions.get('window');

      const _buttons = getDefaultButtons(width, height);
      if (_settings[_title]) {
        const exitButtons = _settings[_title];
        setButtons(exitButtons);
      } else {
        setButtons(_buttons);
      }
      setDefaultButtons(_buttons);
      setReady(true);

      setShowWarnShowModal(true);
    }, 500);

    const unsubscribeBeforeRemove = navigation.addListener(
      'beforeRemove',
      e => {
        // Always prevent the default first: re-dispatching another
        // action without preventDefault lets the original action ALSO
        // proceed, performing it twice.
        e.preventDefault();
        if (e.data.action.type !== 'GO_BACK') {
          navigation.dispatch(e.data.action);
        } else {
          setActionShowModal(true);
        }
      },
    );

    return () => {
      clearTimeout(initTimer);
      unsubscribeBeforeRemove();
      Orientation.unlockAllOrientations();
      FullScreenManager.immersiveModeOff();
    };
  }, [navigation, route.params?.name]);

  // Button drag. Updates are immutable (map + clone the changed
  // button): mutating in place also mutated the factory-defaults copy
  // (it holds the same objects), which silently broke Reset.
  const handleDrag = (name, x, y) => {
    setButtons(prev =>
      prev.map(b =>
        b.name === name ? {...b, x: Math.round(x), y: Math.round(y)} : b,
      ),
    );
  };

  // Button size change
  const handleChangeSize = scale => {
    setButtons(prev =>
      prev.map(b => (b.name === currentButton ? {...b, scale} : b)),
    );
  };

  // Button show change
  const handleChangeShow = value => {
    setCurrentShow(value);
    setButtons(prev =>
      prev.map(b => (b.name === currentButton ? {...b, show: value} : b)),
    );
  };

  const background = {
    borderless: false,
    color: 'rgba(255, 255, 255, 0.2)',
    foreground: true,
  };

  const handleSave = () => {
    // Before initialisation there is nothing valid to save, and
    // without a name the layout would be stored under the '' key —
    // the Default slot.
    if (!ready || !title) {
      return;
    }
    saveSettings(title, buttons);
    navigation.navigate('VirtualGamepadSettings');
  };

  const handleReset = () => {
    if (!ready) {
      return;
    }
    // Clone the default objects, not just the array: the working list
    // must never share objects with the defaults copy.
    setButtons(defaultButtons.map(b => ({...b})));
  };

  const handleDelete = () => {
    // Gated on ready like Save and Reset: acting inside the init
    // window would delete before initialisation has completed.
    if (!ready || !title) {
      return;
    }
    const userSettings = getUserSettings();
    if (userSettings.custom_virtual_gamepad === title) {
      userSettings.custom_virtual_gamepad = '';
      saveUserSettings(userSettings);
    }
    deleteSetting(title);
    navigation.navigate('VirtualGamepadSettings');
  };

  const renderWarningModal = () => {
    return (
      <Portal>
        <Modal
          visible={showWarnModal}
          onDismiss={() => setShowWarnShowModal(false)}
          contentContainerStyle={styles.modal}>
          <Card>
            <Card.Content>
              <Text>
                •{' '}
                {t(
                  'The position of custom virtual buttons may have discrepancies with actual rendering. Please refer to the actual effect for accuracy',
                )}
              </Text>
              <Text>
                • {t('Click on an element to set its size and display')}
              </Text>
              <Text>• {t('Drag elements to adjust their position')}</Text>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderWarningModal()}

      <Portal>
        <Modal
          visible={showActionModal}
          onDismiss={() => setActionShowModal(false)}
          contentContainerStyle={styles.modal}>
          <Card>
            <Card.Content>
              <List.Section>
                <List.Item
                  title={t('Save')}
                  background={background}
                  onPress={() => handleSave()}
                />
                <List.Item
                  title={t('Reset')}
                  background={background}
                  onPress={() => {
                    handleReset();
                    // Close the modal like the other actions do (they
                    // navigate away): leaving it open read as if the
                    // tap had done nothing.
                    setActionShowModal(false);
                  }}
                />
                {settings[title] && (
                  <List.Item
                    title={t('Delete')}
                    background={background}
                    onPress={() => handleDelete()}
                  />
                )}
                <List.Item
                  title={t('Exit')}
                  background={background}
                  onPress={() => navigation.navigate('VirtualGamepadSettings')}
                />
              </List.Section>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      <Portal>
        <Modal
          visible={showModal}
          onDismiss={() => {
            setShowModal(false);
          }}
          contentContainerStyle={styles.modal}>
          <Card>
            <Card.Content>
              {currentButton !== 'LeftStick' &&
                currentButton !== 'RightStick' && (
                  <>
                    <View style={styles.title}>
                      <Text>{t('Size')}</Text>
                      <Divider style={styles.divider} />
                    </View>
                    <Slider
                      value={currentScale}
                      minimumValue={1}
                      maximumValue={4}
                      step={0.1}
                      onValueChange={val => {
                        setCurrentScale(val);
                        handleChangeSize(val);
                      }}
                      lowerLimit={1}
                      minimumTrackTintColor="#107C10"
                      maximumTrackTintColor="grey"
                    />
                  </>
                )}

              <View style={styles.title}>
                <Text>{t('Show')}</Text>
                <Divider style={styles.divider} />
              </View>
              <RadioButton.Group
                onValueChange={val => handleChangeShow(val)}
                value={currentShow}>
                <RadioButton.Item label={t('Display')} value={true} />
                <RadioButton.Item label={t('Hide')} value={false} />
              </RadioButton.Group>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      <>
        {buttons.map(button => {
          // Hidden buttons stay visible (dimmed) in the editor so they can
          // be selected and shown again; hiding only affects the game.
          const isHidden = button.show === false;
          if (button.name === 'LeftStick' || button.name === 'RightStick') {
            return (
              <Draggable
                x={button.x}
                y={button.y}
                key={button.name + reloader}
                renderSize={100}
                renderColor={isHidden ? 'grey' : 'white'}
                isCircle
                onShortPressRelease={() => {
                  setCurrentButton(button.name);
                  setCurrentScale(1);
                  setCurrentShow(!isHidden);
                  setShowModal(true);
                }}
                onDragRelease={event => {
                  handleDrag(
                    button.name,
                    event.nativeEvent.pageX - event.nativeEvent.locationX,
                    event.nativeEvent.pageY - event.nativeEvent.locationY,
                  );
                  setReloader(Date.now());
                }}
              />
            );
          } else {
            return (
              <Draggable
                x={button.x}
                y={button.y}
                key={button.name + reloader}
                onShortPressRelease={() => {
                  setCurrentButton(button.name);
                  setCurrentScale(button.scale || 1);
                  setCurrentShow(!isHidden);
                  setShowModal(true);
                }}
                onDragRelease={event => {
                  handleDrag(
                    button.name,
                    event.nativeEvent.pageX - event.nativeEvent.locationX,
                    event.nativeEvent.pageY - event.nativeEvent.locationY,
                  );
                  setReloader(Date.now());
                }}>
                <View style={{opacity: isHidden ? 0.3 : 1}}>
                  <GamepadButton
                    name={button.name}
                    width={button.width}
                    height={button.height}
                    scale={button.scale}
                  />
                </View>
              </Draggable>
            );
          }
        })}
      </>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modal: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    marginLeft: '35%',
    marginRight: '35%',
  },
  title: {
    paddingTop: 10,
    paddingBottom: 10,
  },
  divider: {
    marginTop: 10,
  },
});

export default CustomGamepadScreen;
