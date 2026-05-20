import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Permissions, ALL_PERMISSIONS } from "@ecommerce/types";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with custom admin…");

  // ──
  const existingAdmin = await prisma.adminUser.findFirst({
    where: { email: "bananadmin@ecommerce.mz" },
  });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("changeMebanananew12", 12);
    await prisma.adminUser.create({
      data: {
        name: "Banana Admin",
        email: "bananadmin@ecommerce.mz",
        passwordHash,
        permissions: BigInt(Permissions.PRODUCTS_VIEW),
        isActive: true,
      },
    });
    console.log(
      "Admin Banana created: bananadmin@ecommerce.mz / changemebanana",
    );
  } else {
    console.log("Admin Banana already exists");
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
