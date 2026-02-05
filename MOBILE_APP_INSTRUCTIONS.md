
# Mobile App Code for "Cybot Authenticator"

This React Native app runs on your Android phone. It reads your College ID (NFC) and sends the UID to your PC via Bluetooth to log you in.

## 1. Setup New Project
```bash
npx react-native@latest init CybotAuth
cd CybotAuth
npm install react-native-nfc-manager react-native-bluetooth-classic
```

## 2. Permissions (AndroidManifest.xml)
Add these lines to `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.NFC" />
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" /> <!-- Android 12+ -->
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />    <!-- Android 12+ -->
<uses-features android:name="android.hardware.nfc" android:required="true" />
```

## 3. App.js Code (Replace existing)
```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

const App = () => {
  const [device, setDevice] = useState(null);
  const [status, setStatus] = useState('Idle');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    NfcManager.start();
    return () => {
      NfcManager.setEventListener(NfcTech.MifareClassic, null);
      NfcManager.setEventListener(NfcTech.Ndef, null);
    };
  }, []);

  // 1. Connect to PC
  const connectToPC = async () => {
    try {
      setStatus('Scanning for PC...');
      // Make sure your PC Bluetooth is discoverable!
      const devices = await RNBluetoothClassic.startDiscovery();
      
      // Look for your PC name (Change 'YOUR_PC_NAME' to actual name or pick from list)
      // For this demo, we'll just pick the first paired device or let user pick.
      // Better: List paired devices
      const paired = await RNBluetoothClassic.getBondedDevices();
      if (paired.length === 0) {
        Alert.alert('No Paired Devices', 'Please pair your phone with your PC first in Android Settings.');
        return;
      }
      
      // Auto-connect to first paired device for demo simplicity
      const target = paired[0]; 
      setStatus(`Connecting to ${target.name}...`);
      
      const isConnected = await target.connect();
      if (isConnected) {
        setDevice(target);
        setConnected(true);
        setStatus(`Connected to ${target.name}`);
      }
    } catch (err) {
      console.log(err);
      setStatus('Connection Failed: ' + err.message);
    }
  };

  // 2. Scan NFC & Send
  const scanAndSend = async () => {
    if (!connected || !device) {
      Alert.alert('Not Connected', 'Connect to PC Bluetooth first.');
      return;
    }

    try {
      setStatus('Tap NFC Card...');
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      
      setStatus(`Card Found: ${tag.id}`);
      
      // Payload
      const payload = JSON.stringify({
        nfc_uid: tag.id,
        timestamp: Date.now()
      });

      // Send via Bluetooth
      setStatus('Sending to PC...');
      await device.write(payload);
      
      setStatus('Sent! Check PC Screen.');
    } catch (ex) {
      console.warn(ex);
      setStatus('NFC Error');
    } finally {
      NfcManager.cancelTechnologyRequest();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cybot Auth</Text>
      
      <View style={styles.card}>
        <Text style={styles.status}>{status}</Text>
      </View>

      <TouchableOpacity 
        style={[styles.btn, connected ? styles.btnDisabled : styles.btnConnect]} 
        onPress={connectToPC}
        disabled={connected}
      >
        <Text style={styles.btnText}>{connected ? 'PC Connected' : 'Connect to PC'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnBig} onPress={scanAndSend}>
        <Text style={styles.btnTextBig}>SCAN NFC CARD</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20, justifyContent: 'center' },
  title: { color: '#fff', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 40 },
  card: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12, marginBottom: 40, alignItems: 'center' },
  status: { color: '#bfdbfe', fontSize: 18, fontFamily: 'monospace' },
  btn: { padding: 16, borderRadius: 8, marginBottom: 20, alignItems: 'center' },
  btnConnect: { backgroundColor: '#3b82f6' },
  btnDisabled: { backgroundColor: '#22c55e' },
  btnBig: { backgroundColor: '#eab308', padding: 40, borderRadius: 20, alignItems: 'center', shadowColor: '#eab308', elevation: 10 },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  btnTextBig: { color: '#000', fontWeight: '900', fontSize: 24, letterSpacing: 2 },
});

export default App;
```
