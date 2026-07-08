import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** 네이버 사용자 고유 ID */
      id: string;
    } & DefaultSession["user"];
  }
}
