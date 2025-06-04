/**
 * Messages atom
 * Contains the messages state
 */
import { atom } from 'recoil';

const messagesAtom = atom({
  key: 'messagesAtom',
  default: [],
});

export default messagesAtom;
