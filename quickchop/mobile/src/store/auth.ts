import { create } from "zustand";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Customer } from "@/api/types";

interface AuthState {
  session: Session | null;
  customer: Customer | null;
  initializing: boolean;
  setSession: (session: Session | null) => void;
  setCustomer: (customer: Customer | null) => void;
  signOut: () => Promise<void>;
  init: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  customer: null,
  initializing: true,
  setSession: (session) => set({ session }),
  setCustomer: (customer) => set({ customer }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, customer: null });
  },
  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, initializing: false });
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
    });
  },
}));
