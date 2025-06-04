/**
 * Public only route component
 * Redirects authenticated users to the home page
 */
import { Navigate } from "react-router-dom";
import { useRecoilValue } from "recoil";
import { userAtom } from "../atoms";

const PublicOnlyRoute = ({ children }) => {
  const user = useRecoilValue(userAtom);

  if (user) {
    return <Navigate to="/" />;
  }

  return children;
};

export default PublicOnlyRoute;
