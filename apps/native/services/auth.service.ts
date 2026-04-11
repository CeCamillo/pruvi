import { authClient } from "@/lib/auth-client";

export const authService = {
  login: (email: string, password: string) =>
    authClient.signIn.email({ email, password }),

  register: (name: string, email: string, password: string) =>
    authClient.signUp.email({ name, email, password }),

  logout: () => authClient.signOut(),
};
