"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("../generated/prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const globalForPrisma = globalThis;
function getPrismaClient() {
    const connectionString = process.env.DATABASE_URL ||
        process.env.DIRECT_URL ||
        "";
    if (!connectionString) {
        console.warn("WARNING: DATABASE_URL and DIRECT_URL are not set. Ensure they are configured in Vercel environment variables.");
    }
    const adapter = new adapter_pg_1.PrismaPg({ connectionString });
    return new client_1.PrismaClient({ adapter });
}
exports.prisma = globalForPrisma.prisma ?? getPrismaClient();
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = exports.prisma;
}
