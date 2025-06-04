/**
 * Recoil atoms index
 * Exports all atoms organized by feature
 */
import { userAtom } from './user';
import { postsAtom } from './post';
import { messagesAtom } from './message';
import { authScreenAtom } from './auth';
import {
  conversationsAtom,
  selectedConversationAtom
} from './messagesAtom';

export {
  // User-related atoms
  userAtom,

  // Post-related atoms
  postsAtom,

  // Message-related atoms
  messagesAtom,
  conversationsAtom,
  selectedConversationAtom,

  // Auth-related atoms
  authScreenAtom,
};
