/**
 * Hooks index
 * Exports all custom hooks organized by feature
 */
import { useFollowUnfollow, useGetUserProfile, useLogout } from './user';
import { usePreviewImg, useShowToast } from './ui';
import { useSocket, useSocketEvent, useSocketEmit, useSocketRoom } from './socket';

export {
  // User hooks
  useFollowUnfollow,
  useGetUserProfile,
  useLogout,

  // UI hooks
  usePreviewImg,
  useShowToast,

  // Socket hooks
  useSocket,
  useSocketEvent,
  useSocketEmit,
  useSocketRoom
};
