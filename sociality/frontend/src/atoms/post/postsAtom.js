/**
 * Posts atom
 * Contains the posts state
 */
import { atom } from 'recoil';

const postsAtom = atom({
  key: 'postsAtom',
  default: [],
});

export default postsAtom;
