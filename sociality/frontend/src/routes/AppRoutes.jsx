/**
 * Application routes
 * Contains all route definitions for the application
 */
import { Route, Routes } from "react-router-dom";
import HomePage from "../pages/HomePage";
import AuthPage from "../pages/AuthPage";
import UpdateProfilePage from "../pages/UpdateProfilePage";
import ProfileSetupPage from "../pages/ProfileSetupPage";
import UserPage from "../pages/UserPage";
import PostPage from "../pages/PostPage";
import ChatPage from "../pages/ChatPage";
import { SettingsPage } from "../pages/SettingsPage";
import SearchPage from "../pages/SearchPage";
import NotificationsPage from "../pages/NotificationsPage";
import OAuthPopupCallback from "../components/OAuthPopupCallback";
import OAuthTestPage from "../pages/OAuthTestPage";

import CreatePost from "../components/CreatePost";
import ProtectedRoute from "./ProtectedRoute";
import PublicOnlyRoute from "./PublicOnlyRoute";
import OnboardingRoute from "./OnboardingRoute";
import { useRecoilValue } from "recoil";
import { userAtom } from "../atoms";

const AppRoutes = () => {
  const user = useRecoilValue(userAtom);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <OnboardingRoute>
              <HomePage />
            </OnboardingRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/auth"
        element={
          <PublicOnlyRoute>
            <AuthPage />
          </PublicOnlyRoute>
        }
      />

      <Route
        path="/oauth-popup-callback"
        element={<OAuthPopupCallback />}
      />

      <Route
        path="/profile-setup"
        element={
          <ProtectedRoute>
            <ProfileSetupPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/update"
        element={
          <ProtectedRoute>
            <OnboardingRoute>
              <UpdateProfilePage />
            </OnboardingRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/:username"
        element={
          <ProtectedRoute>
            <OnboardingRoute>
              {user ? (
                <>
                  <UserPage />
                  <CreatePost />
                </>
              ) : (
                <UserPage />
              )}
            </OnboardingRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/:username/post/:pid"
        element={
          <ProtectedRoute>
            <OnboardingRoute>
              <PostPage />
            </OnboardingRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <OnboardingRoute>
              <ChatPage />
            </OnboardingRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <OnboardingRoute>
              <SettingsPage />
            </OnboardingRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/search"
        element={
          <ProtectedRoute>
            <OnboardingRoute>
              <SearchPage />
            </OnboardingRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <OnboardingRoute>
              <NotificationsPage />
            </OnboardingRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/oauth-test"
        element={<OAuthTestPage />}
      />

    </Routes>
  );
};

export default AppRoutes;
