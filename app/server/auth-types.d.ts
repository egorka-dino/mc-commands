import "next-auth";
import "next-auth/jwt";
import type { AutomationRole } from "./automation-auth";

declare module "next-auth" {
  interface User {
    authType?: "automation";
    automationRole?: AutomationRole;
    automationExpiresAt?: number;
    automationKeyVersion?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    authType?: "automation";
    automationRole?: AutomationRole;
    automationExpiresAt?: number;
    automationKeyVersion?: string;
  }
}
