import React from 'react';
import {StyleSheet, View, ScrollView} from 'react-native';
import {
  Button,
  IconButton,
  RadioButton,
  Text,
  Divider,
  Portal,
  Modal,
  Card,
  HelperText,
  TextInput,
} from 'react-native-paper';
import {useTranslation} from 'react-i18next';
import {useIsFocused} from '@react-navigation/native';
import {
  getSettings as getUserSettings,
  saveSettings as saveUserSettings,
} from '../store/settingStore';
import {getSettings} from '../store/gamepadStore';

function VirtualGamepadSettingsScreen({navigation}) {
  const {t} = useTranslation();
  const [value, setValue] = React.useState('');
  const [name, setName] = React.useState('');
  const [nameTouched, setNameTouched] = React.useState(false);
  const [userSettings, setUserSettings] = React.useState({});
  const [settings, setSettings] = React.useState([]);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const navTimer = React.useRef(null);
  // The saved selection is loaded once, not on every focus: reloading
  // it on each focus would silently discard a choice the user just
  // made here whenever the screen regains focus without unmounting.
  const valueLoadedRef = React.useRef(false);
  const isFocused = useIsFocused();
  // Mirror of the selection for the focus effect below: the effect
  // deliberately does not depend on `value` (it must run on focus
  // changes, not on every selection change), but it still needs the
  // current selection to validate it against the reloaded list.
  const valueRef = React.useRef('');
  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  React.useEffect(() => {
    return () => {
      if (navTimer.current) {
        clearTimeout(navTimer.current);
        navTimer.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="plus"
          size={28}
          onPress={() => {
            setShowAddModal(true);
          }}
        />
      ),
    });
  }, [navigation]);

  // Reload the layout list every time this page is shown, so layouts that
  // were just created, edited or deleted in the editor appear correctly.
  React.useEffect(() => {
    if (!isFocused) {
      return;
    }
    const _settings = getSettings();
    setSettings(Object.keys(_settings));

    const _userSettings = getUserSettings();
    setUserSettings(_userSettings);
    if (!valueLoadedRef.current) {
      valueLoadedRef.current = true;
      const storedSelection = _userSettings.custom_virtual_gamepad || '';
      // The existence check below must cover the FIRST load too: a
      // selection persisted by an older version (or left behind by
      // a delete path that did not clear it) can name a layout that
      // no longer exists, and Edit would open the editor on factory
      // defaults under that name.
      setValue(
        storedSelection &&
          !Object.keys(_settings).includes(storedSelection)
          ? ''
          : storedSelection,
      );
    } else if (
      valueRef.current &&
      !Object.keys(_settings).includes(valueRef.current)
    ) {
      // The selected layout was deleted in the editor while this
      // page was away: clear the selection instead of leaving Edit
      // pointing at a name that no longer exists — the editor would
      // load factory defaults under it, and saving there would
      // silently recreate a layout the user just deleted.
      setValue('');
    }
  }, [isFocused]);

  const handleSave = () => {
    // Never persist a selection that no longer exists (its layout
    // may have been deleted in the editor): fall back to Default.
    const validValue = value === '' || settings.includes(value) ? value : '';
    const next = {...userSettings, custom_virtual_gamepad: validValue};
    setUserSettings(next);
    saveUserSettings(next);
    navigation.goBack();
  };

  const handleEdit = () => {
    navigation.navigate('CustomGamepad', {name: value});
  };

  const onChangeText = text => {
    setNameTouched(true);
    setName(text);
  };

  let errorText = '';
  let isError = false;
  if (!name.trim()) {
    isError = true;
    errorText = t('Name can not be empty');
  } else if (
    // Case-insensitive: "Layout" and "layout" must not coexist as two
    // different layouts.
    settings.some(s => s.toLowerCase() === name.trim().toLowerCase())
  ) {
    isError = true;
    errorText = t('Name already exists');
  }

  return (
    <View style={styles.container}>
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => {
            setShowAddModal(false);
            setName('');
            setNameTouched(false);
          }}
          contentContainerStyle={styles.modal}>
          <Card>
            <Card.Content>
              <TextInput
                label={t('Name')}
                value={name}
                onChangeText={onChangeText}
              />
              <HelperText type="error" visible={isError && nameTouched}>
                {errorText}
              </HelperText>

              <Button
                mode="contained"
                disabled={isError}
                style={{marginTop: 20}}
                onPress={() => {
                  setNameTouched(true);
                  if (!isError) {
                    const newName = name.trim();
                    setShowAddModal(false);
                    // Clear the field so reopening the dialog does not
                    // show the just-created name (and instantly flag it
                    // as already existing).
                    setName('');
                    setNameTouched(false);
                    navTimer.current = setTimeout(() => {
                      navTimer.current = null;
                      navigation.navigate('CustomGamepad', {
                        name: newName,
                      });
                    }, 300);
                  }
                }}>
                {t('Confirm')}
              </Button>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      <ScrollView style={styles.scrollView}>
        <View style={styles.tips}>
          <Text>{t('Customize buttons of virtual gamepad')}</Text>
        </View>
        <Divider />

        <RadioButton.Group onValueChange={val => setValue(val)} value={value}>
          <RadioButton.Item label={t('Default')} value={''} />
          {settings.map(s => {
            return <RadioButton.Item key={s} label={s} value={s} />;
          })}
        </RadioButton.Group>
      </ScrollView>

      <View style={styles.buttonWrap}>
        <Button mode="contained" style={styles.button} onPress={handleSave}>
          {t('Select')}
        </Button>
        {value !== '' && (
          <Button mode="outlined" style={styles.button} onPress={handleEdit}>
            {t('Edit')}
          </Button>
        )}
        <Button
          mode="outlined"
          style={styles.button}
          onPress={() => navigation.goBack()}>
          {t('Back')}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tips: {
    padding: 10,
  },
  scrollView: {
    marginBottom: 120,
  },
  buttonWrap: {
    position: 'absolute',
    left: 0,
    width: '100%',
    bottom: 20,
    paddingLeft: 10,
    paddingRight: 10,
  },
  button: {
    marginTop: 10,
  },
  modal: {
    margin: 20,
  },
});

export default VirtualGamepadSettingsScreen;
