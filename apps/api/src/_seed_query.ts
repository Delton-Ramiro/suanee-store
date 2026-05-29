import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const HOMEM_ID = 'ecaaa828-dae4-419e-812c-79209be0f9f1';
prisma.category.findMany({ where: { parentId: HOMEM_ID }, select: { id: true, name: true, level: true }, orderBy: { position: 'asc' } })
  .then(cats => { console.log(JSON.stringify(cats, null, 2)); return prisma.$disconnect(); });
