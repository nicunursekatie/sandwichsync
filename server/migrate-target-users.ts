import 'dotenv/config';
import { storage } from './storage-wrapper.js';

// Target users from the User Management interface
const targetUsers = [
  {
    email: 'admin@sandwich.project',
    firstName: 'Admin',
    lastName: 'User',
    displayName: 'Admin User',
    role: 'super_admin',
    permissions: ['super_admin', 'admin', 'user_management', 'analytics', 'reports'],
    isActive: true,
    metadata: {
      password: 'admin123', // Default password
      migratedAt: new Date().toISOString(),
      source: 'target_migration'
    }
  },
  {
    email: 'katielong2316@gmail.com',
    firstName: 'Katie',
    lastName: 'Long',
    displayName: 'Katie Long',
    role: 'admin',
    permissions: ['admin', 'user_management', 'analytics', 'reports'],
    isActive: true,
    metadata: {
      password: 'katie123', // Default password
      migratedAt: new Date().toISOString(),
      source: 'target_migration'
    }
  },
  {
    email: 'mdlouza@gmail.com',
    firstName: 'Marcy',
    lastName: 'Louza',
    displayName: 'Marcy Louza',
    role: 'admin',
    permissions: ['admin', 'user_management', 'analytics', 'reports'],
    isActive: true,
    metadata: {
      password: 'marcy123', // Default password
      migratedAt: new Date().toISOString(),
      source: 'target_migration'
    }
  },
  {
    email: 'kenig.ka@gmail.com',
    firstName: 'Katie',
    lastName: 'Long',
    displayName: 'Katie Long',
    role: 'driver',
    permissions: ['driver', 'delivery'],
    isActive: true,
    metadata: {
      password: 'katie123', // Default password
      migratedAt: new Date().toISOString(),
      source: 'target_migration'
    }
  },
  {
    email: 'stephanie@thesandwichproject.org',
    firstName: 'Stephanie',
    lastName: 'Luis',
    displayName: 'Stephanie Luis',
    role: 'admin',
    permissions: ['admin', 'user_management', 'analytics', 'reports'],
    isActive: true,
    metadata: {
      password: 'stephanie123', // Default password
      migratedAt: new Date().toISOString(),
      source: 'target_migration'
    }
  },
  {
    email: 'christine@thesandwichproject.org',
    firstName: 'Christine',
    lastName: 'Cooper Nowicki',
    displayName: 'Christine Cooper Nowicki',
    role: 'admin',
    permissions: ['admin', 'user_management', 'analytics', 'reports'],
    isActive: true,
    metadata: {
      password: 'christine123', // Default password
      migratedAt: new Date().toISOString(),
      source: 'target_migration'
    }
  },
  {
    email: 'vickib@aol.com',
    firstName: 'Vicki',
    lastName: 'Tropauer',
    displayName: 'Vicki Tropauer',
    role: 'admin',
    permissions: ['admin', 'user_management', 'analytics', 'reports'],
    isActive: true,
    metadata: {
      password: 'vicki123', // Default password
      migratedAt: new Date().toISOString(),
      source: 'target_migration'
    }
  }
];

interface MigrationStats {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function migrateTargetUsers(overwrite: boolean = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: targetUsers.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  console.log(`🎯 Starting targeted migration of ${stats.total} users from User Management interface`);
  console.log(`🔄 Overwrite existing: ${overwrite}\n`);

  for (const targetUser of targetUsers) {
    try {
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(targetUser.email);
      
      if (existingUser) {
        if (!overwrite) {
          console.log(`⏭️  Skipping existing user: ${targetUser.email} (${targetUser.role})`);
          stats.skipped++;
          continue;
        } else {
          // Update existing user
          await storage.updateUser(existingUser.id, {
            ...targetUser,
            id: existingUser.id, // Keep the existing ID
            createdAt: existingUser.createdAt, // Keep original creation date
            updatedAt: new Date()
          });
          console.log(`✅ Updated user: ${targetUser.email} (${targetUser.role})`);
          stats.updated++;
        }
      } else {
        // Create new user
        const userData = {
          ...targetUser,
          id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await storage.createUser(userData);
        console.log(`✅ Created user: ${targetUser.email} (${targetUser.role})`);
        stats.created++;
      }

    } catch (error) {
      const errorMsg = `Failed to migrate user ${targetUser.email}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`❌ ${errorMsg}`);
      stats.errors.push(errorMsg);
      stats.failed++;
    }
  }

  // Print migration summary
  console.log('\n📊 Target Migration Summary:');
  console.log(`Total users: ${stats.total}`);
  console.log(`✅ Created: ${stats.created}`);
  console.log(`🔄 Updated: ${stats.updated}`);
  console.log(`⏭️  Skipped: ${stats.skipped}`);
  console.log(`❌ Failed: ${stats.failed}`);
  
  if (stats.errors.length > 0) {
    console.log('\n🚨 Errors:');
    stats.errors.forEach(error => console.log(`  - ${error}`));
  }

  return stats;
}

// Preview function
export async function previewTargetMigration(): Promise<void> {
  console.log(`📋 Target Migration Preview for ${targetUsers.length} users:\n`);
  
  const roleCount: Record<string, number> = {};
  const existingUsers: string[] = [];
  const newUsers: string[] = [];

  for (const user of targetUsers) {
    // Count roles
    roleCount[user.role] = (roleCount[user.role] || 0) + 1;
    
    // Check if user exists
    const existingUser = await storage.getUserByEmail(user.email);
    if (existingUser) {
      existingUsers.push(`${user.email} (${user.role})`);
    } else {
      newUsers.push(`${user.email} (${user.role})`);
    }
  }

  console.log('📊 User breakdown by role:');
  Object.entries(roleCount).forEach(([role, count]) => {
    console.log(`  ${role}: ${count} users`);
  });

  console.log(`\n🆕 New users to be created: ${newUsers.length}`);
  newUsers.forEach(userInfo => console.log(`  - ${userInfo}`));

  console.log(`\n⚠️  Existing users: ${existingUsers.length}`);
  existingUsers.forEach(userInfo => console.log(`  - ${userInfo}`));

  console.log('\n💡 To run the actual migration:');
  console.log('  npx tsx server/migrate-target-users.ts');
  console.log('  npx tsx server/migrate-target-users.ts --overwrite  (to update existing users)');
}

// CLI handler
export async function runTargetMigration() {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite') || args.includes('-o');
  const preview = args.includes('--preview') || args.includes('-p');

  if (preview) {
    await previewTargetMigration();
    return;
  }

  try {
    const stats = await migrateTargetUsers(overwrite);
    
    if (stats.failed === 0) {
      console.log('\n🎉 Target migration completed successfully!');
    } else {
      console.log('\n⚠️  Target migration completed with some errors.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Target migration failed completely:', error);
    process.exit(1);
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  runTargetMigration();
}
