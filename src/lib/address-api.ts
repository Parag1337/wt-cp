import { ApiError } from "./auth";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
      ...options,
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please try again.");
  }

  const data = (await response.json().catch(() => null)) as
    | (T & { message?: string; success?: boolean })
    | null;

  if (!response.ok) {
    const message =
      data && typeof data.message === "string"
        ? data.message
        : "Something went wrong. Please try again.";
    throw new ApiError(message);
  }
  if (!data) {
    throw new ApiError("Empty response from server.");
  }
  return data;
}

export type SavedAddress = {
  id: number;
  customerId: number;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark: string | null;
  label: string | null;
  isDefault: boolean;
};

export type AddressListResponse = { success: boolean; addresses: SavedAddress[] };
export type AddressResponse = { success: boolean; address: SavedAddress };

export const addressApi = {
  list(): Promise<AddressListResponse> {
    return request<AddressListResponse>("/addresses");
  },
  create(payload: Record<string, unknown>): Promise<AddressResponse> {
    return request<AddressResponse>("/addresses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  update(id: number, payload: Record<string, unknown>): Promise<AddressResponse> {
    return request<AddressResponse>(`/addresses/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
  remove(id: number): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/addresses/${id}`, {
      method: "DELETE",
    });
  },
  setDefault(id: number): Promise<AddressResponse> {
    return request<AddressResponse>(`/addresses/${id}/default`, {
      method: "POST",
    });
  },
};
