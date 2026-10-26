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
    return fetch("/api/addresses", { credentials: "include" }).then((r) => r.json());
  },
  create(payload: Partial<SavedAddress> & Record<string, unknown>): Promise<AddressResponse> {
    return fetch("/api/addresses", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());
  },
  update(id: number, payload: Record<string, unknown>): Promise<AddressResponse> {
    return fetch(`/api/addresses/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());
  },
  remove(id: number): Promise<{ success: boolean }> {
    return fetch(`/api/addresses/${id}`, {
      method: "DELETE",
      credentials: "include",
    }).then((r) => r.json());
  },
  setDefault(id: number): Promise<AddressResponse> {
    return fetch(`/api/addresses/${id}/default`, {
      method: "POST",
      credentials: "include",
    }).then((r) => r.json());
  },
};