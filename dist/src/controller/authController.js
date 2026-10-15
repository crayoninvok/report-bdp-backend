"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = void 0;
const prisma_1 = require("../lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        const user = await prisma_1.prisma.users.findUnique({
            where: { email: email.trim().toLowerCase() },
        });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        let finalUser = user;
        if (user.jobSite === "HeadOffice" && user.role !== "SuperAdmin") {
            finalUser = await prisma_1.prisma.users.update({
                where: { id: user.id },
                data: { role: "SuperAdmin" },
            });
        }
        const { password: _, ...userData } = finalUser;
        return res.json({
            message: "Login successful",
            user: userData,
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
exports.login = login;
