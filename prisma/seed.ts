import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Neither DIRECT_URL nor DATABASE_URL is defined in the environment variables.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const seedUsers = [
  {
    name: "PM Muara Pahu 01",
    email: "priyanto@bataramining.com",
    plainPassword: "mp@batara2026",
    role: "User" as const,
    jobSite: "MuaraPahu" as const,
  },
  {
    name: "PM Senyiur 01",
    email: "a.oktayudhaperkasa@bataramining.com",
    plainPassword: "sny@batara2026",
    role: "User" as const,
    jobSite: "Senyiur" as const,
  },
  {
    name: "HO Admin 01",
    email: "dzaky.athariqf@bataramining.com",
    plainPassword: "@Rosdian12",
    role: "SuperAdmin" as const,
    jobSite: "HeadOffice" as const,
  },
];

async function main() {
  console.log("Starting database seed...");

  for (const user of seedUsers) {
    const hashedPassword = await bcrypt.hash(user.plainPassword, 10);

    const record = await prisma.users.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: hashedPassword,
        role: user.role,
        jobSite: user.jobSite,
      },
      create: {
        name: user.name,
        email: user.email,
        password: hashedPassword,
        role: user.role,
        jobSite: user.jobSite,
      },
    });

    console.log(`Seeded user: ${record.name} (${record.email}) [Role: ${record.role}] [JobSite: ${record.jobSite}]`);
  }

  console.log("Seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
