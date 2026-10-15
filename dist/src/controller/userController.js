"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.createUser = exports.getUsers = void 0;
const prisma_1 = require("../lib/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const getUsers = async (req, res) => {
    try {
        const authUser = req.user;
        // RULE: Only SuperAdmin can manage users!
        if (authUser?.role !== "SuperAdmin") {
            return res.status(403).json({
                success: false,
                message: "Akses Ditolak: Hanya Super Admin yang berhak mengakses manajemen pengguna!",
            });
        }
        const users = await prisma_1.prisma.users.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                email: true,
                jobSite: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({ success: true, data: users });
    }
    catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ success: false, message: "Gagal mengambil daftar pengguna" });
    }
};
exports.getUsers = getUsers;
const createUser = async (req, res) => {
    try {
        const authUser = req.user;
        // RULE: Only SuperAdmin can create users!
        if (authUser?.role !== "SuperAdmin") {
            return res.status(403).json({
                success: false,
                message: "Akses Ditolak: Hanya Super Admin yang berhak menambahkan pengguna baru!",
            });
        }
        const { name, email, password, jobSite, role } = req.body;
        if (!name || !email || !password || !jobSite) {
            return res.status(400).json({
                success: false,
                message: "Nama, email, password, dan job site wajib diisi",
            });
        }
        const cleanEmail = email.trim().toLowerCase();
        const existingUser = await prisma_1.prisma.users.findUnique({
            where: { email: cleanEmail },
        });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email sudah terdaftar pada sistem",
            });
        }
        // RULE: Users registered with HeadOffice are automatically SuperAdmin
        const resolvedRole = jobSite === "HeadOffice" ? "SuperAdmin" : role === "SuperAdmin" ? "SuperAdmin" : "User";
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const newUser = await prisma_1.prisma.users.create({
            data: {
                name: name.trim(),
                email: cleanEmail,
                password: hashedPassword,
                jobSite: jobSite,
                role: resolvedRole,
            },
            select: {
                id: true,
                name: true,
                email: true,
                jobSite: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({
            success: true,
            message: `Pengguna ${newUser.name} berhasil didaftarkan`,
            data: newUser,
        });
    }
    catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ success: false, message: "Gagal membuat pengguna baru" });
    }
};
exports.createUser = createUser;
const updateUser = async (req, res) => {
    try {
        const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
        const authUser = req.user;
        // RULE: Only SuperAdmin can edit users!
        if (authUser?.role !== "SuperAdmin") {
            return res.status(403).json({
                success: false,
                message: "Akses Ditolak: Hanya Super Admin yang berhak mengedit pengguna!",
            });
        }
        const existing = await prisma_1.prisma.users.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan" });
        }
        const { name, email, password, jobSite, role } = req.body;
        const cleanEmail = email ? email.trim().toLowerCase() : existing.email;
        if (cleanEmail !== existing.email) {
            const emailOccupied = await prisma_1.prisma.users.findUnique({ where: { email: cleanEmail } });
            if (emailOccupied && emailOccupied.id !== id) {
                return res.status(400).json({
                    success: false,
                    message: "Email sudah digunakan oleh pengguna lain",
                });
            }
        }
        // RULE: Users assigned to HeadOffice are automatically SuperAdmin
        const targetJobSite = jobSite || existing.jobSite;
        const targetRole = targetJobSite === "HeadOffice"
            ? "SuperAdmin"
            : role === "SuperAdmin"
                ? "SuperAdmin"
                : role === "User"
                    ? "User"
                    : existing.role;
        const updateData = {
            name: name ? name.trim() : existing.name,
            email: cleanEmail,
            jobSite: targetJobSite,
            role: targetRole,
        };
        if (password && typeof password === "string" && password.trim().length > 0) {
            updateData.password = await bcryptjs_1.default.hash(password.trim(), 10);
        }
        const updatedUser = await prisma_1.prisma.users.update({
            where: { id },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                jobSite: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.json({
            success: true,
            message: `Data pengguna ${updatedUser.name} berhasil diperbarui`,
            data: updatedUser,
        });
    }
    catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ success: false, message: "Gagal memperbarui pengguna" });
    }
};
exports.updateUser = updateUser;
const deleteUser = async (req, res) => {
    try {
        const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
        const authUser = req.user;
        // RULE: Only SuperAdmin can delete users!
        if (authUser?.role !== "SuperAdmin") {
            return res.status(403).json({
                success: false,
                message: "Akses Ditolak: Hanya Super Admin yang berhak menghapus pengguna!",
            });
        }
        // Prevent self-deletion
        if (authUser?.id === id) {
            return res.status(400).json({
                success: false,
                message: "Anda tidak dapat menghapus akun Anda sendiri saat sedang login!",
            });
        }
        const user = await prisma_1.prisma.users.findUnique({ where: { id } });
        if (!user) {
            return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan" });
        }
        await prisma_1.prisma.users.delete({ where: { id } });
        res.json({
            success: true,
            message: `Pengguna ${user.name} (${user.email}) berhasil dihapus`,
        });
    }
    catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ success: false, message: "Gagal menghapus pengguna" });
    }
};
exports.deleteUser = deleteUser;
