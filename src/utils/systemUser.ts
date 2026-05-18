import { db } from '../services/db.js';
import { logger } from './logger.js';

/**
 * Utility to ensure a system user exists for automated processes.
 * This prevents relational errors when no real user is authenticated.
 */
export async function getSystemUserId(): Promise<string> {
  try {
    // 1. Try to find the first user (seeded user)
    const user = await db.user.findFirst();
    if (user) return user.id;

    // 2. If no user, emergency creation
    logger.warn('⚠️ No users found in database. Initializing emergency system user...');
    
    // Find or create an organization first
    let org = await db.organization.findFirst();
    if (!org) {
      org = await db.organization.create({
        data: { name: 'Emergency Org', slug: 'emergency-org' }
      });
    }
    
    // Find or create a role
    let role = await db.role.findFirst({ where: { organizationId: org.id } });
    if (!role) {
      role = await db.role.create({
        data: { name: 'SYSTEM_ADMIN', organizationId: org.id }
      });
    }

    const systemUser = await db.user.create({
      data: {
        email: 'system@sportsmed.ai',
        password: 'system_managed_key',
        name: 'AI System Ingestion',
        organizationId: org.id,
        roleId: role.id
      }
    });

    return systemUser.id;
  } catch (error) {
    logger.error('❌ Failed to resolve system user ID:', error);
    throw new Error('Database is in an unrecoverable state: No users could be assigned.');
  }
}
