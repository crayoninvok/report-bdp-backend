import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";
import { JobSite, UserRole } from "../generated/prisma/client";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

export const getUsers = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;

    // RULE: Only SuperAdmin can manage users!
    if (authUser?.role !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        message: "Akses Ditolak: Hanya Super Admin yang berhak mengakses manajemen pengguna!",
      });
    }

    const users = await prisma.users.findMany({
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
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil daftar pengguna" });
  }
};

export const createUser = async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthenticatedRequest).user;

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

    const existingUser = await prisma.users.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email sudah terdaftar pada sistem",
      });
    }

    // RULE: Users registered with HeadOffice are automatically SuperAdmin
    const resolvedRole: UserRole =
      jobSite === "HeadOffice" ? "SuperAdmin" : role === "SuperAdmin" ? "SuperAdmin" : "User";

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.users.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        jobSite: jobSite as JobSite,
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
  } catch (error: any) {
    console.error("Error creating user:", error);
    res.status(500).json({ success: false, message: "Gagal membuat pengguna baru" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const authUser = (req as AuthenticatedRequest).user;

    // RULE: Only SuperAdmin can edit users!
    if (authUser?.role !== "SuperAdmin") {
      return res.status(403).json({
        success: false,
        message: "Akses Ditolak: Hanya Super Admin yang berhak mengedit pengguna!",
      });
    }

    const existing = await prisma.users.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan" });
    }

    const { name, email, password, jobSite, role } = req.body;

    const cleanEmail = email ? email.trim().toLowerCase() : existing.email;

    if (cleanEmail !== existing.email) {
      const emailOccupied = await prisma.users.findUnique({ where: { email: cleanEmail } });
      if (emailOccupied && emailOccupied.id !== id) {
        return res.status(400).json({
          success: false,
          message: "Email sudah digunakan oleh pengguna lain",
        });
      }
    }

    // RULE: Users assigned to HeadOffice are automatically SuperAdmin
    const targetJobSite = (jobSite as JobSite) || existing.jobSite;
    const targetRole: UserRole =
      targetJobSite === "HeadOffice"
        ? "SuperAdmin"
        : role === "SuperAdmin"
        ? "SuperAdmin"
        : role === "User"
        ? "User"
        : existing.role;

    const updateData: any = {
      name: name ? name.trim() : existing.name,
      email: cleanEmail,
      jobSite: targetJobSite,
      role: targetRole,
    };

    if (password && typeof password === "string" && password.trim().length > 0) {
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    const updatedUser = await prisma.users.update({
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
  } catch (error: any) {
    console.error("Error updating user:", error);
    res.status(500).json({ success: false, message: "Gagal memperbarui pengguna" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;
    const authUser = (req as AuthenticatedRequest).user;

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

    const user = await prisma.users.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ success: false, message: "Pengguna tidak ditemukan" });
    }

    await prisma.users.delete({ where: { id } });

    res.json({
      success: true,
      message: `Pengguna ${user.name} (${user.email}) berhasil dihapus`,
    });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    res.status(500).json({ success: false, message: "Gagal menghapus pengguna" });
  }
};
