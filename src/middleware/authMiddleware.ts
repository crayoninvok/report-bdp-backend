import { Request, Response, NextFunction } from "express";
import { JobSite, UserRole } from "../generated/prisma/client";

export interface AuthenticatedUser {
  id?: string;
  email?: string;
  role: UserRole;
  jobSite: JobSite;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const extractUser = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const roleHeader = (req.headers["x-user-role"] || req.body?.userRole) as UserRole | undefined;
  const jobSiteHeader = (req.headers["x-user-jobsite"] || req.body?.userJobSite) as JobSite | undefined;
  const idHeader = (req.headers["x-user-id"] || req.body?.userId) as string | undefined;
  const emailHeader = (req.headers["x-user-email"] || req.body?.userEmail) as string | undefined;

  if (jobSiteHeader) {
    req.user = {
      id: idHeader,
      email: emailHeader,
      role: roleHeader === "SuperAdmin" ? "SuperAdmin" : "User",
      jobSite: jobSiteHeader,
    };
  }

  next();
};
