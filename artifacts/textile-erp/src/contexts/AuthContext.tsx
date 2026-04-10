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

  const syncAuthState = (nextUser: User | null, nextToken?: string | null) => {
    if (nextToken && shouldAttachBearerToken()) {
      setToken(nextToken);
    } else if (!shouldAttachBearerToken()) {
      clearToken();
    }

    setUser(nextUser);
    // Reflect the active transport mode and the token as actually persisted,
    // instead of coupling context state to a raw login response token.
    setTokenState(shouldAttachBearerToken() ? getToken() : null);
  };

  useEffect(() => {
    const cleanupAuth = () => {
      clearToken();
      syncAuthState(null);
    };

    const removeAuthListener = addAuthFailureListener(cleanupAuth);
    const canBootstrap = canBootstrapAuthSession();

    if (canBootstrap) {
      fetchCurrentUser()
        .then((data) => {
          if (data && data.id) {
            syncAuthState(data);
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
    syncAuthState(response.user, response.token);
  };

  const logout = () => {
    void requestLogout().finally(() => {
      clearToken();
      syncAuthState(null);
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
