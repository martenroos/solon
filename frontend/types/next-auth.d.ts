import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email: string;
      image?: string | null;
      isVerified: boolean;
      isAdmin: boolean;
      provider?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    email?: string;
    name?: string | null;
    picture?: string | null;
    provider?: string;
    isVerified?: boolean;
    isAdmin?: boolean;
  }
}
