import { passwordSchema } from '@qc/shared';
import { z } from 'zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { createPasswordService } from '../services/password.service.js';

const WEAK_PASSWORDS = new Set([
  'password',
  'password1',
  'change-me',
  'changeme',
  'admin',
  'admin123',
]);

export const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000001';

export interface SeedInput {
  email: string | undefined;
  password: string | undefined;
}

export function assertAdminSeedInput(input: SeedInput): { email: string; password: string } {
  if (input.email === undefined || input.email.trim() === '') {
    throw new Error('ADMIN_EMAIL is required');
  }
  if (input.password === undefined || input.password === '') {
    throw new Error('ADMIN_PASSWORD is required');
  }
  const email = input.email.trim().toLowerCase();
  const emailResult = z.email().safeParse(email);
  if (!emailResult.success) {
    throw new Error('ADMIN_EMAIL must be an email address');
  }
  const passwordResult = passwordSchema.safeParse(input.password);
  if (!passwordResult.success) {
    throw new Error(passwordResult.error.issues[0]?.message ?? 'ADMIN_PASSWORD is weak');
  }
  if (WEAK_PASSWORDS.has(input.password.toLowerCase())) {
    throw new Error('ADMIN_PASSWORD is a known weak password');
  }
  return { email, password: input.password };
}

interface CategorySeed {
  id: string;
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

interface SubcategorySeed {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  sortOrder: number;
}

interface ProductSeed {
  id: string;
  subcategoryId: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  unitLabel: string;
  pricePaise: number;
  stock: number;
  imageUrl: string;
}

const categories: CategorySeed[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Dairy & Bread',
    slug: 'dairy-bread',
    description: 'Milk, butter, and everyday bread.',
    sortOrder: 1,
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Snacks',
    slug: 'snacks',
    description: 'Chips and namkeen.',
    sortOrder: 2,
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Beverages',
    slug: 'beverages',
    description: 'Juices and cold drinks.',
    sortOrder: 3,
  },
];

const subcategories: SubcategorySeed[] = [
  {
    id: '20000000-0000-4000-8000-000000000001',
    categoryId: '10000000-0000-4000-8000-000000000001',
    name: 'Milk',
    slug: 'milk',
    sortOrder: 1,
  },
  {
    id: '20000000-0000-4000-8000-000000000002',
    categoryId: '10000000-0000-4000-8000-000000000001',
    name: 'Bread',
    slug: 'bread',
    sortOrder: 2,
  },
  {
    id: '20000000-0000-4000-8000-000000000003',
    categoryId: '10000000-0000-4000-8000-000000000002',
    name: 'Chips',
    slug: 'chips',
    sortOrder: 1,
  },
  {
    id: '20000000-0000-4000-8000-000000000004',
    categoryId: '10000000-0000-4000-8000-000000000003',
    name: 'Juices',
    slug: 'juices',
    sortOrder: 1,
  },
];

const products: ProductSeed[] = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    subcategoryId: '20000000-0000-4000-8000-000000000001',
    name: 'Amul Taaza Milk',
    slug: 'amul-taaza-milk-1l',
    sku: 'MILK-AMUL-1L',
    description: 'Toned milk, 1 litre.',
    unitLabel: '1 L',
    pricePaise: 2800,
    stock: 40,
    imageUrl: 'https://images.example.com/amul-taaza-milk.jpg',
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    subcategoryId: '20000000-0000-4000-8000-000000000001',
    name: 'Amul Butter',
    slug: 'amul-butter-500g',
    sku: 'BUTTER-AMUL-500',
    description: 'Pasteurised butter for toast and cooking.',
    unitLabel: '500 g',
    pricePaise: 5600,
    stock: 25,
    imageUrl: 'https://images.example.com/amul-butter.jpg',
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    subcategoryId: '20000000-0000-4000-8000-000000000002',
    name: 'Harvest Bread',
    slug: 'harvest-bread-400g',
    sku: 'BREAD-HARVEST-400',
    description: 'Sliced white bread.',
    unitLabel: '400 g',
    pricePaise: 4500,
    stock: 12,
    imageUrl: 'https://images.example.com/harvest-bread.jpg',
  },
  {
    id: '30000000-0000-4000-8000-000000000004',
    subcategoryId: '20000000-0000-4000-8000-000000000003',
    name: 'Classic Chips',
    slug: 'classic-chips-100g',
    sku: 'CHIPS-CLASSIC-100',
    description: 'Salted potato chips.',
    unitLabel: '100 g',
    pricePaise: 2000,
    stock: 4,
    imageUrl: 'https://images.example.com/classic-chips.jpg',
  },
  {
    id: '30000000-0000-4000-8000-000000000005',
    subcategoryId: '20000000-0000-4000-8000-000000000004',
    name: 'Orange Juice',
    slug: 'orange-juice-1l',
    sku: 'JUICE-ORANGE-1L',
    description: 'Chilled orange juice.',
    unitLabel: '1 L',
    pricePaise: 9000,
    stock: 18,
    imageUrl: 'https://images.example.com/orange-juice.jpg',
  },
  {
    id: '30000000-0000-4000-8000-000000000006',
    subcategoryId: '20000000-0000-4000-8000-000000000003',
    name: 'Salted Peanuts',
    slug: 'salted-peanuts-200g',
    sku: 'PEANUT-SALTED-200',
    description: 'Roasted salted peanuts.',
    unitLabel: '200 g',
    pricePaise: 5000,
    stock: 0,
    imageUrl: 'https://images.example.com/salted-peanuts.jpg',
  },
];

export async function seedDatabase(prisma: PrismaClient, input: SeedInput): Promise<void> {
  const admin = assertAdminSeedInput(input);
  const passwordHash = await createPasswordService().hash(admin.password);

  await prisma.user.upsert({
    where: { email: admin.email },
    update: {
      passwordHash,
      name: 'Store Admin',
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      id: ADMIN_USER_ID,
      email: admin.email,
      passwordHash,
      name: 'Store Admin',
      role: 'ADMIN',
      isActive: true,
    },
  });

  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        sortOrder: category.sortOrder,
        isActive: true,
        deletedAt: null,
      },
      create: category,
    });
  }

  for (const subcategory of subcategories) {
    await prisma.subcategory.upsert({
      where: { id: subcategory.id },
      update: {
        categoryId: subcategory.categoryId,
        name: subcategory.name,
        slug: subcategory.slug,
        sortOrder: subcategory.sortOrder,
        isActive: true,
        deletedAt: null,
      },
      create: subcategory,
    });
  }

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        subcategoryId: product.subcategoryId,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        description: product.description,
        unitLabel: product.unitLabel,
        pricePaise: product.pricePaise,
        stock: product.stock,
        imageUrl: product.imageUrl,
        isActive: true,
        deletedAt: null,
      },
      create: product,
    });
  }
}
