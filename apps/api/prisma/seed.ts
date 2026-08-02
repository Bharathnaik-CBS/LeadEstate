import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import {
  OnboardingStatus,
  PrismaClient,
  UserRole,
} from '../src/generated/prisma/client';

const LOCAL_ADMIN_EMAIL = 'admin@leadestate.local';
const LOCAL_ADMIN_PASSWORD = 'LeadEstateLocalAdmin123!';
const MIN_ADMIN_PASSWORD_LENGTH = 12;
const DEFAULT_PLATFORMS = [
  'Direct Visit',
  'Phone Call',
  'Website',
  'Facebook',
  'Instagram',
  'Referral',
  'WhatsApp',
  'Other',
];

function getAdminSeedUser() {
  const isProduction = process.env.NODE_ENV === 'production';
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
  const name = process.env.ADMIN_NAME?.trim() || 'Admin User';

  if (isProduction) {
    if (!configuredEmail) {
      throw new Error('ADMIN_EMAIL is required when seeding production');
    }

    if (!isStrongAdminPassword(configuredPassword)) {
      throw new Error(
        `ADMIN_PASSWORD is required when seeding production and must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`,
      );
    }

    return {
      name,
      email: configuredEmail,
      password: configuredPassword,
      role: UserRole.ADMIN,
    };
  }

  if (!configuredEmail) {
    console.warn(`Using local development admin email: ${LOCAL_ADMIN_EMAIL}`);
  }

  return {
    name,
    email: configuredEmail || LOCAL_ADMIN_EMAIL,
    password: configuredPassword || LOCAL_ADMIN_PASSWORD,
    role: UserRole.ADMIN,
  };
}

function isStrongAdminPassword(password?: string): password is string {
  return Boolean(
    password &&
      password.length >= MIN_ADMIN_PASSWORD_LENGTH &&
      password !== LOCAL_ADMIN_PASSWORD,
  );
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is missing. Check apps/api/.env');
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const adminUser = getAdminSeedUser();
    const passwordHash = await hash(adminUser.password, 10);
    const user = await prisma.user.upsert({
      where: {
        email: adminUser.email,
      },
      update: {
        name: adminUser.name,
        role: adminUser.role,
        onboardingStatus: OnboardingStatus.ACTIVE,
      },
      create: {
        name: adminUser.name,
        email: adminUser.email,
        password: passwordHash,
        role: adminUser.role,
        onboardingStatus: OnboardingStatus.ACTIVE,
      },
    });

    console.log(`Seeded admin user: ${user.email} (${user.role})`);

    await Promise.all(
      DEFAULT_PLATFORMS.map((name) =>
        prisma.platform.upsert({
          where: {
            name,
          },
          update: {},
          create: {
            name,
          },
        }),
      ),
    );

    console.log(`Seeded ${DEFAULT_PLATFORMS.length} default platforms`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
