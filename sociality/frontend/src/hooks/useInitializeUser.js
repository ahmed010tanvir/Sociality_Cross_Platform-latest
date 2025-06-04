import { useEffect } from 'react';
import { useSetRecoilState } from 'recoil';
import { userAtom } from '../atoms';
import { getCurrentTabUser } from '../utils/api';

/**
 * Hook to initialize user state from tab-specific storage
 * This should be called once when the app loads
 */
const useInitializeUser = () => {
  const setUser = useSetRecoilState(userAtom);

  useEffect(() => {
    // Initialize user state from tab-specific storage
    const userData = getCurrentTabUser();
    if (userData) {
      setUser(userData);
    }
  }, [setUser]);
};

export default useInitializeUser;
