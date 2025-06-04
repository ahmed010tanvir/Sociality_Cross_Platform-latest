/**
 * Protected route component
 * Redirects unauthenticated users to the auth page
 */
import { Navigate, useLocation } from "react-router-dom";
import { useRecoilValue } from "recoil";
import { userAtom } from "../atoms";

const ProtectedRoute = ({ children }) => {
  const user = useRecoilValue(userAtom);
  const location = useLocation();

  // Check if this is an OAuth callback
  const urlParams = new URLSearchParams(location.search);
  const isOAuthCallback = urlParams.get('oauth') === 'success' || urlParams.get('error');

  // Allow OAuth callback to be processed even without user
  if (!user && !isOAuthCallback) {
    return <Navigate to="/auth" />;
  }

  return children;
};

export default ProtectedRoute;
