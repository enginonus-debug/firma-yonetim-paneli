import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      firmaId: number;
      rol: string;
    } & DefaultSession["user"];
  }

  interface User {
    firmaId?: number;
    rol?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    firmaId?: number;
    rol?: string;
  }
}
