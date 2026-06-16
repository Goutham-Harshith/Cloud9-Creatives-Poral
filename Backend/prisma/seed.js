const { PrismaClient, UserRole } = require('@prisma/client');
const { hashSync } = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: {
      email: 'gouthamharshith115@gmail.com',
    },
    update: {
      name: 'Cloud9 Admin',
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    },
    create: {
      email: 'gouthamharshith115@gmail.com',
      name: 'Cloud9 Admin',
      role: UserRole.SUPER_ADMIN,
      passwordHash: hashSync('test@123', 10),
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
