import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgres://postgres:postgres@127.0.0.1:51214/template1?sslmode=disable",
    },
  },
});

async function main() {
  const sifreHash = await bcrypt.hash("1234", 10);

  await prisma.kullanici.deleteMany({ where: { email: "admin@firma.local" } });
  await prisma.kullanici.upsert({
    where: { email: "admin" },
    update: { sifreHash, adSoyad: "Yönetici", rol: "yonetici" },
    create: {
      email: "admin",
      adSoyad: "Yönetici",
      sifreHash,
      rol: "yonetici",
    },
  });

  console.log("Yönetici güncellendi: admin / 1234");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
