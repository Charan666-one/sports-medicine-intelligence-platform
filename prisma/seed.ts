import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Phase 2 Seed: Starting enterprise data population...');

  // 1. Create Organizations
  const org = await prisma.organization.upsert({
    where: { slug: 'wada-global' },
    update: {},
    create: {
      name: 'World Anti-Doping Authority',
      slug: 'wada-global',
    },
  });

  // 2. Create Roles
  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      description: 'Full system access',
      organizationId: org.id,
    }
  });

  const doctorRole = await prisma.role.create({
    data: {
      name: 'DOCTOR',
      description: 'Medical report management',
      organizationId: org.id,
    }
  });

  // 3. Create Users
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@sportsmed.com',
      password: 'hashed_password_here',
      name: 'Dr. Sarah Smith',
      organizationId: org.id,
      roleId: adminRole.id,
    }
  });

  // 4. Create Athletes
  const athlete = await prisma.athlete.create({
    data: {
      name: 'John Doe',
      dateOfBirth: new Date('1995-05-15'),
      gender: 'Male',
      nationality: 'USA',
      sport: 'Swimming',
      status: 'ACTIVE',
      organizationId: org.id,
      medicalProfile: {
        create: {
          bloodType: 'A+',
          allergies: 'None',
          history: 'Shoulder surgery 2022'
        }
      }
    }
  });

  const suspiciousAthlete = await prisma.athlete.create({
    data: {
      name: 'Ivan Petrov',
      dateOfBirth: new Date('1992-08-20'),
      gender: 'Male',
      nationality: 'RUS',
      sport: 'Weightlifting',
      status: 'UNDER_INVESTIGATION',
      organizationId: org.id,
      medicalProfile: {
        create: {
          bloodType: 'B-',
          allergies: 'None',
          history: 'None'
        }
      }
    }
  });

  // 5. Create Medical Reports
  // John (Normal)
  await prisma.medicalReport.create({
    data: {
      type: 'BLOOD',
      status: 'COMPLETED',
      athleteId: athlete.id,
      creatorId: adminUser.id,
      testResults: {
        create: [
          { parameter: 'Hemoglobin', value: 16.2, unit: 'g/dL', isAtypical: false },
          { parameter: 'Hematocrit', value: 48.5, unit: '%', isAtypical: false },
          { parameter: 'EPO', value: 0.1, unit: 'mU/mL', isAtypical: false }
        ]
      }
    }
  });

  // Ivan (Suspicious - Current)
  await prisma.medicalReport.create({
    data: {
      type: 'BLOOD',
      status: 'FLAGGED',
      athleteId: suspiciousAthlete.id,
      creatorId: adminUser.id,
      testResults: {
        create: [
          { parameter: 'Hemoglobin', value: 18.1, unit: 'g/dL', isAtypical: true },
          { parameter: 'Hematocrit', value: 52.4, unit: '%', isAtypical: true },
          { parameter: 'Testosterone Ratio', value: 6.2, unit: 'T/E', isAtypical: true }
        ]
      }
    }
  });

  // Ivan (Suspicious - Historical for trend analysis)
  await prisma.medicalReport.create({
    data: {
      type: 'BLOOD',
      status: 'COMPLETED',
      athleteId: suspiciousAthlete.id,
      creatorId: adminUser.id,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      testResults: {
        create: [
          { parameter: 'Hemoglobin', value: 15.2, unit: 'g/dL', isAtypical: false },
          { parameter: 'Hematocrit', value: 46.1, unit: '%', isAtypical: false },
          { parameter: 'Testosterone Ratio', value: 1.2, unit: 'T/E', isAtypical: false }
        ]
      }
    }
  });

  // Ivan (Suspicious - Historical for trend analysis - Baseline Series)
  const baseDates = [60, 90, 120, 150];
  for (const daysBack of baseDates) {
    await prisma.medicalReport.create({
      data: {
        type: 'BLOOD',
        status: 'COMPLETED',
        athleteId: suspiciousAthlete.id,
        creatorId: adminUser.id,
        createdAt: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000),
        testResults: {
          create: [
            { parameter: 'Hemoglobin', value: 14.8 + Math.random() * 0.4, unit: 'g/dL', isAtypical: false },
            { parameter: 'Hematocrit', value: 44.5 + Math.random() * 1.0, unit: '%', isAtypical: false },
            { parameter: 'Testosterone Ratio', value: 0.9 + Math.random() * 0.3, unit: 'T/E', isAtypical: false }
          ]
        }
      }
    });
  }

  // 6. Create Risk Assessment
  await prisma.riskAssessment.create({
    data: {
      athleteId: athlete.id,
      score: 12.5,
      category: 'LOW',
      findings: 'Baseline metrics established. No anomalies detected.',
    }
  });

  // 7. Create Alerts
  await prisma.alert.create({
    data: {
      athleteId: athlete.id,
      severity: 'CRITICAL',
      message: 'Suspicious hematological variation detected in Swimming Baseline.',
      isResolved: false
    }
  });

  await prisma.alert.create({
    data: {
      athleteId: athlete.id,
      severity: 'WARNING',
      message: 'Athlete reported unscheduled training session in restricted zone.',
      isResolved: true,
      resolvedAt: new Date()
    }
  });

  console.log('✅ Phase 2 Seed: Success! Database fully populated with enterprise entities.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
