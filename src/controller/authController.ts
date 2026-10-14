import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import bcrypt from "bcryptjs";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.users.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    let finalUser = user;
    if (user.jobSite === "HeadOffice" && user.role !== "SuperAdmin") {
      finalUser = await prisma.users.update({
        where: { id: user.id },
        data: { role: "SuperAdmin" },
      });
    }

    const { password: _, ...userData } = finalUser;

    return res.json({
      message: "Login successful",
      user: userData,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
