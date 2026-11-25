import { prisma } from "../src/lib/prisma";

const userDepartmentMap: Record<string, string> = {
  "agung.putrabatara@bataramining.com": "HSE",
  "hamdani@bataramining.com": "PRODUCTION & ENGINEERING",
  "teguh.pujonggo@bataramining.com": "LOGISTIC",
  "andi.pallawa@bataramining.com": "HRGA",
  "untung.subekti@bataramining.com": "HSE",
  "angga.zurrahman@bataramining.com": "PLANT",
  "rahmad.hidayat@bataramining.com": "HSE",
  "cindra.hasan@bataramining.com": "HSE",
  "priyanto@bataramining.com": "OPERATION",
  "fandi.achmadakbar@bataramining.com": "PLANT",
  "dellafajar@bataramining.com": "HRGA",
  "ody.wildan@bataramining.com": "PLANT",
  "khairul.aziz@bataramining.com": "OPERATION",
  "armansyah@bataramining.com": "PLANT",
  "muhammad.rizaldi@bataramining.com": "PLANT",
  "noffan.amiruddin@bataramining.com": "PLANT",
  "sumardi@bataramining.com": "OPERATION",
  "dadang.setyawan@bataramining.com": "PLANT",
  "djumadi.herlambang@bataramining.com": "ACCOUNTING",
  "dio.tragitza.r@bataramining.com": "OPERATION",
  "kemal.musthafa@bataramining.com": "OPERATION",
  "dzaky.athariqf@bataramining.com": "OPERATION",
  "a.oktayudhaperkasa@bataramining.com": "OPERATION",
  "zulfahmi@bataramining.com": "OPERATION",
};

async function main() {
  console.log("Starting user department update...");
  let count = 0;

  for (const [email, dept] of Object.entries(userDepartmentMap)) {
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (user) {
      await prisma.users.update({
        where: { id: user.id },
        data: { department: dept },
      });
      console.log(`✓ Updated [${dept}] for ${user.email} (${user.name})`);
      count++;
    } else {
      console.warn(`⚠ User not found: ${email}`);
    }
  }

  console.log(`Successfully updated ${count} users with their respective departments.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error updating user departments:", err);
  process.exit(1);
});
