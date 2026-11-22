//frontend/src/context/AuthContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import PropTypes from "prop-types";

const AuthContext = createContext(null);

const TOKEN_STORAGE_KEY = "datara_auth_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return (
        localStorage.getItem(TOKEN_STORAGE_KEY) ||
        localStorage.getItem("token") ||
        null
      );
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem("token");
      }
    } catch {
      // Ignore storage access errors
    }
  }, [token]);

  const login = useCallback((nextToken, nextUser = null) => {
    setToken(nextToken || null);
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      token: null,
      user: null,
      isAuthenticated: false,
      login: () => {},
      logout: () => {},
    };
  }
  return ctx;
}

export default AuthContext;
