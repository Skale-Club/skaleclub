// Contract between the NFC app shell (client/src/pages/NfcApp.tsx) and the
// auth layer (trusted device + passkey/Face ID). Implementations live beside this file.
export { NfcLogin } from './NfcLogin';
export { DevicesScreen } from './DevicesScreen';
export { AppLockGate } from './AppLockGate';
export { TrustedDeviceSync } from './TrustedDeviceSync';
