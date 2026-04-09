import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import {
  addAuthFailureListener,
  canBootstrapAuthSession,
  clearToken,
  fetchCurrentUser,
  getToken,
  requestLogout,
  setToken,
  shouldAttachBearerToken,
} from "@/lib/auth";
import { type AuthResponse, type User } from "@workspace/api-client-react";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (response: AuthResponse) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const cleanupAuth = () => {
      clearToken();
      setTokenState(null);
      setUser(null);
    };

    const syncAuthenticatedUser = (nextUser: User, storedToken: string | null) => {
      setUser(nextUser);
      // Keep context token aligned with the active session mode.
      setTokenState(shouldAttachBearerToken() ? storedToken : null);
    };

    const removeAuthListener = addAuthFailureListener(cleanupAuth);
    const storedToken = getToken();
    const canBootstrap = canBootstrapAuthSession();

    if (canBootstrap) {
      fetchCurrentUser()
        .then((data) => {
          if (data && data.id) {
            syncAuthenticatedUser(data, storedToken);
          } else {
            cleanupAuth();
          }
        })
        .catch(() => cleanupAuth())
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }

    return removeAuthListener;
  }, []);

  const login = (response: AuthResponse) => {
    if (shouldAttachBearerToken()) {
      setToken(response.token);
      setTokenState(response.token);
    } else {
      clearToken();
      setTokenState(null);
    }
    setUser(response.user);
  };

  const logout = () => {
    void requestLogout().finally(() => {
      clearToken();
      setTokenState(null);
      setUser(null);
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
