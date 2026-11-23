import {MMKV} from 'react-native-mmkv';

export const storage = new MMKV();

// Auth tokens live in their own MMKV instance, exactly as upstream
// ships it: a plain instance. An earlier build of ours made this an
// ENCRYPTED instance whose key was generated once and kept in the
// default storage above. That design is removed: the key sat in
// plaintext next to the data it protected (no real protection), and
// the encrypted instance's Android native path is the one part of the
// sign-in chain that misbehaves there — writes/reads against it fail
// while every other store (all plain instances) works, which left
// Android unable to persist a login at all. A fresh instance id is
// used so no bytes written by the encrypted instance are ever read
// back through the plain one.
export const tokenStorage = new MMKV({
  id: 'tokenstore.plain',
});
