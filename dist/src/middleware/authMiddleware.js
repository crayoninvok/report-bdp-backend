"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractUser = void 0;
const extractUser = (req, res, next) => {
    const roleHeader = (req.headers["x-user-role"] || req.body?.userRole);
    const jobSiteHeader = (req.headers["x-user-jobsite"] || req.body?.userJobSite);
    const idHeader = (req.headers["x-user-id"] || req.body?.userId);
    const emailHeader = (req.headers["x-user-email"] || req.body?.userEmail);
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
exports.extractUser = extractUser;
