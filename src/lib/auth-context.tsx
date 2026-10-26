"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { authApi, type Customer } from "./auth";

type AuthStatus = "loading" | "authenticated" | "guest";

type AuthContextValue = {
  status: AuthStatus;
  customer: Customer | null;
  login: (email: string, password: string) => Promise<Customer>;
  register: (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<Customer>;
  logout: () => Promise<void>;
};

let authContextSingleton: ReturnType<typeof createContext<AuthContextValue | null>> | null = null;

function getAuthContext() {
  if (!authContextSingleton) {
    authContextSingleton = createContext<AuthContextValue | null>(null);
  }
  return authContextSingleton;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const AuthContext = getAuthContext();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    let active = true;
    authApi
      .me()
      .then((data) => {
        if (!active) return;
        if (data.customer) {
          setCustomer(data.customer);
          setStatus("authenticated");
        } else {
          setCustomer(null);
          setStatus("guest");
        }
      })
      .catch(() => {
        if (active) {
          setCustomer(null);
          setStatus("guest");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string): Promise<Customer> {
    const data = await authApi.login({ email, password });
    if (!data.customer) {
      throw new Error("Unable to sign you in. Please try again.");
    }
    setCustomer(data.customer);
    setStatus("authenticated");
    return data.customer;
  }

  async function register(payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<Customer> {
    const data = await authApi.register(payload);
    if (!data.customer) {
      throw new Error("Unable to create your account. Please try again.");
    }
    setCustomer(data.customer);
    setStatus("authenticated");
    return data.customer;
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } finally {
      setCustomer(null);
      setStatus("guest");
    }
  }

  return (
    <AuthContext.Provider value={{ status, customer, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const AuthContext = getAuthContext();
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
