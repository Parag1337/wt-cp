export type Customer = {
  id: number;
  fullName: string;
  email: string;
  phone: string;
};

export type AuthResponse = {
  success: boolean;
  message: string;
  customer?: Customer;
};

export class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please try again.");
  }

  const data = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    const authData = data as unknown as AuthResponse | null;
    const message =
      authData && typeof authData.message === "string"
        ? authData.message
        : "Something went wrong. Please try again.";
    throw new ApiError(message);
  }

  return data as unknown as T;
}

export const authApi = {
  register(payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<AuthResponse> {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }): Promise<AuthResponse> {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  me(): Promise<AuthResponse> {
    return request("/auth/me");
  },

  logout(): Promise<AuthResponse> {
    return request("/auth/logout", { method: "POST" });
  },

  changePassword(payload: {
    currentPassword: string;
    newPassword: string;
  }): Promise<AuthResponse> {
    return request("/auth/password", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
};