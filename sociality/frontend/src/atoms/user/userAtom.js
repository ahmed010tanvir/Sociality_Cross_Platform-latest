/**
 * User atom with multi-tab support
 * Contains the current user state for the current tab
 */
import { atom } from 'recoil';

const userAtom = atom({
  key: 'userAtom',
  default: null, // Start with null, will be set by components
});

export default userAtom;
