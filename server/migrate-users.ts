import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { storage } from './storage-wrapper.js';

interface BackupUser {
  id: string;
  email: string;
  password: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
  profileImageUrl: string | null;
  role: string;
  permissions: (string | null)[];
  metadata: {
    password?: string;
    [key: string]: any;
  };
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface MigrationStats {
  total: number;
  successful: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function migrateUsersFromJson(filePath: string = './backup_files/users.json', overwrite: boolean = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    // Read and parse the users.json file
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const backupUsers: BackupUser[] = JSON.parse(jsonData);
    
    stats.total = backupUsers.length;
    console.log(`🔄 Starting migration of ${stats.total} users from ${filePath}`);

    for (const backupUser of backupUsers) {
      try {
        // Check if user already exists
        const existingUser = await storage.getUserByEmail(backupUser.email);
        
        if (existingUser && !overwrite) {
          console.log(`⏭️  Skipping existing user: ${backupUser.email}`);
          stats.skipped++;
          continue;
        }

        // Clean up permissions array (remove null values)
        const cleanPermissions = backupUser.permissions.filter(p => p !== null);

        // Prepare user data for migration
        const userData = {
          id: backupUser.id,
          email: backupUser.email,
          firstName: backupUser.firstName || 'Unknown',
          lastName: backupUser.lastName || 'User',
          displayName: backupUser.displayName,
          profileImageUrl: backupUser.profileImageUrl,
          role: backupUser.role || 'volunteer',
          permissions: cleanPermissions,
          metadata: {
            ...backupUser.metadata,
            password: backupUser.metadata?.password || 'migrated123', // Default password if none found
            migratedAt: new Date().toISOString(),
            originalId: backupUser.id
          },
          isActive: backupUser.isActive !== false, // Default to true if not specified
          lastLoginAt: backupUser.lastLoginAt ? new Date(backupUser.lastLoginAt) : null,
          createdAt: backupUser.createdAt ? new Date(backupUser.createdAt) : new Date(),
          updatedAt: backupUser.updatedAt ? new Date(backupUser.updatedAt) : new Date()
        };

        // Create or update user
        if (existingUser && overwrite) {
          await storage.updateUser(backupUser.id, userData);
          console.log(`✅ Updated user: ${backupUser.email} (${backupUser.role})`);
        } else {
          await storage.createUser(userData);
          console.log(`✅ Created user: ${backupUser.email} (${backupUser.role})`);
        }

        stats.successful++;

      } catch (error) {
        const errorMsg = `Failed to migrate user ${backupUser.email}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }

    // Print migration summary
    console.log('\n📊 Migration Summary:');
    console.log(`Total users: ${stats.total}`);
    console.log(`✅ Successful: ${stats.successful}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);
    
    if (stats.errors.length > 0) {
      console.log('\n🚨 Errors:');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }

    return stats;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Function to run migration with CLI arguments
export async function runMigration() {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite') || args.includes('-o');
  const filePath = args.find(arg => arg.endsWith('.json')) || './backup_files/users.json';

  console.log('🚀 Starting user migration...');
  console.log(`📁 Source file: ${filePath}`);
  console.log(`🔄 Overwrite existing: ${overwrite}`);
  console.log('');

  try {
    const stats = await migrateUsersFromJson(filePath, overwrite);
    
    if (stats.failed === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Migration failed completely:', error);
    process.exit(1);
  }
}

// Helper function to preview migration without executing
export async function previewMigration(filePath: string = './backup_files/users.json'): Promise<void> {
  try {
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const backupUsers: BackupUser[] = JSON.parse(jsonData);
    
    console.log(`📋 Migration Preview for ${backupUsers.length} users:\n`);
    
    const roleCount: Record<string, number> = {};
    const existingUsers: string[] = [];
    const newUsers: string[] = [];

    for (const user of backupUsers) {
      // Count roles
      roleCount[user.role] = (roleCount[user.role] || 0) + 1;
      
      // Check if user exists
      const existingUser = await storage.getUserByEmail(user.email);
      if (existingUser) {
        existingUsers.push(user.email);
      } else {
        newUsers.push(user.email);
      }
    }

    console.log('📊 User breakdown by role:');
    Object.entries(roleCount).forEach(([role, count]) => {
      console.log(`  ${role}: ${count} users`);
    });

    console.log(`\n🆕 New users to be created: ${newUsers.length}`);
    if (newUsers.length > 0 && newUsers.length <= 10) {
      newUsers.forEach(email => console.log(`  - ${email}`));
    } else if (newUsers.length > 10) {
      newUsers.slice(0, 10).forEach(email => console.log(`  - ${email}`));
      console.log(`  ... and ${newUsers.length - 10} more`);
    }

    console.log(`\n⚠️  Existing users that would be skipped: ${existingUsers.length}`);
    if (existingUsers.length > 0 && existingUsers.length <= 10) {
      existingUsers.forEach(email => console.log(`  - ${email}`));
    } else if (existingUsers.length > 10) {
      existingUsers.slice(0, 10).forEach(email => console.log(`  - ${email}`));
      console.log(`  ... and ${existingUsers.length - 10} more`);
    }

    console.log('\n💡 To run the actual migration:');
    console.log('  npm run migrate-users');
    console.log('  npm run migrate-users -- --overwrite  (to overwrite existing users)');

  } catch (error) {
    console.error('❌ Preview failed:', error);
  }
}

// CLI handler
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (command === 'preview') {
    previewMigration();
  } else {
    runMigration();
  }
}
