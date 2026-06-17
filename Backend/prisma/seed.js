const { PrismaClient, UserRole } = require('@prisma/client');
const { hashSync } = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      email: 'gouthamharshith115@gmail.com',
      name: 'Cloud9 Admin',
      password: 'test@123',
      role: UserRole.SUPER_ADMIN,
    },
    {
      email: 'suchidanthuluri@gmail.com',
      name: 'Suchi Danthuluri',
      password: 'suchibhanu369',
      role: UserRole.SUPER_ADMIN,
    },
    {
      email: 'hema@yopmail.com',
      name: 'Hema',
      password: 'cloud9',
      role: UserRole.MANAGER,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: {
        email: user.email,
      },
      update: {
        name: user.name,
        role: user.role,
        passwordHash: hashSync(user.password, 10),
        isActive: true,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: hashSync(user.password, 10),
      },
    });
  }
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
