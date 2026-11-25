"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../lib/prisma");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
async function main() {
    console.log('--- Starting Backdate Ticket Import ---');
    const ticketsPath = path_1.default.join(__dirname, '../../prepared_tickets.json');
    const plafonsPath = path_1.default.join(__dirname, '../../prepared_plafons.json');
    const ticketsRaw = JSON.parse(fs_1.default.readFileSync(ticketsPath, 'utf-8'));
    const plafonsRaw = JSON.parse(fs_1.default.readFileSync(plafonsPath, 'utf-8'));
    console.log(`Loaded ${ticketsRaw.length} tickets and ${plafonsRaw.length} plafons.`);
    // 1. Clean existing records in tables to avoid duplicate backdate history
    console.log('Cleaning existing TicketUsageHistory and ManpowerTicketPlafon...');
    const deletedHistories = await prisma_1.prisma.ticketUsageHistory.deleteMany({});
    const deletedPlafons = await prisma_1.prisma.manpowerTicketPlafon.deleteMany({});
    console.log(`Deleted ${deletedHistories.count} history records and ${deletedPlafons.count} plafon records.`);
    // 2. Insert tickets in batches of 100
    console.log('Inserting tickets into TicketUsageHistory...');
    const batchSize = 100;
    for (let i = 0; i < ticketsRaw.length; i += batchSize) {
        const chunk = ticketsRaw.slice(i, i + batchSize).map((t) => ({
            employeeId: t.employeeId,
            ticketNumber: t.ticketNumber,
            destination: t.destination,
            airline: t.airline,
            departureDate: new Date(t.departureDate),
            returnDate: t.returnDate ? new Date(t.returnDate) : null,
            ticketCost: t.ticketCost,
            status: t.status || 'Used',
            notes: t.notes,
        }));
        await prisma_1.prisma.ticketUsageHistory.createMany({
            data: chunk,
        });
        console.log(`Inserted tickets ${i + 1} to ${Math.min(i + batchSize, ticketsRaw.length)}`);
    }
    // 3. Upsert plafons
    console.log('Upserting ManpowerTicketPlafon records...');
    for (const p of plafonsRaw) {
        await prisma_1.prisma.manpowerTicketPlafon.upsert({
            where: { employeeId: p.employeeId },
            update: {
                plafonAmount: p.plafonAmount,
                usedAmount: p.usedAmount,
                lastDepartureDate: p.lastDepartureDate ? new Date(p.lastDepartureDate) : null,
                nextResetDate: p.nextResetDate ? new Date(p.nextResetDate) : null,
                ticketCount: p.ticketCount,
                notes: p.notes,
            },
            create: {
                employeeId: p.employeeId,
                plafonAmount: p.plafonAmount,
                usedAmount: p.usedAmount,
                lastDepartureDate: p.lastDepartureDate ? new Date(p.lastDepartureDate) : null,
                nextResetDate: p.nextResetDate ? new Date(p.nextResetDate) : null,
                ticketCount: p.ticketCount,
                notes: p.notes,
            },
        });
    }
    console.log(`Upserted ${plafonsRaw.length} ManpowerTicketPlafon records.`);
    // 4. Verification
    const totalHist = await prisma_1.prisma.ticketUsageHistory.count();
    const totalPlaf = await prisma_1.prisma.manpowerTicketPlafon.count();
    const activeUsagePlaf = await prisma_1.prisma.manpowerTicketPlafon.count({
        where: { usedAmount: { gt: 0 } },
    });
    console.log('\n--- VERIFICATION RESULT ---');
    console.log(`Total TicketUsageHistory in DB: ${totalHist}`);
    console.log(`Total ManpowerTicketPlafon in DB: ${totalPlaf}`);
    console.log(`Employees with active usedAmount (> 0): ${activeUsagePlaf}`);
    console.log('Import finished successfully!');
}
main()
    .catch((e) => {
    console.error('Import failed with error:', e);
    process.exit(1);
})
    .finally(() => prisma_1.prisma.$disconnect());
