import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  email: string | null;
  fullName: string | null;
  /** True while the admin is still on the temporary password from their invite. */
  mustChangePassword: boolean;
  setAuth: (token: string, email: string, fullName: string | null, mustChangePassword?: boolean) => void;
  clearMustChangePassword: () => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      email: null,
      fullName: null,
      mustChangePassword: false,
      setAuth: (token, email, fullName, mustChangePassword = false) =>
        set({ token, email, fullName, mustChangePassword }),
      clearMustChangePassword: () => set({ mustChangePassword: false }),
      logout: () => set({ token: null, email: null, fullName: null, mustChangePassword: false }),
    }),
    { name: "quickchop-admin-auth" }
  )
);
