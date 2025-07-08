import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { storage } from './storage-wrapper.js';

interface MigrationStats {
  total: number;
  successful: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface BackupHost {
  id: number;
  name: string;
  address: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export async function migrateHosts(filePath: string = './backup_files/hosts.json', overwrite: boolean = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    console.log(`🏠 Starting hosts migration from ${filePath}`);
    
    // Read and parse the hosts.json file
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const backupHosts: BackupHost[] = JSON.parse(jsonData);
    
    stats.total = backupHosts.length;
    console.log(`📊 Found ${stats.total} hosts to migrate`);

    for (const host of backupHosts) {
      try {
        // Check if host already exists by name
        const existingHosts = await storage.getAllHosts();
        const existingHost = existingHosts.find(h => h.name.toLowerCase() === host.name.toLowerCase());

        if (existingHost && !overwrite) {
          console.log(`⏭️  Skipping existing host: ${host.name}`);
          stats.skipped++;
          continue;
        }

        const hostData = {
          name: host.name,
          address: host.address || '',
          status: host.status || 'active',
          notes: host.notes || '',
          createdAt: new Date(host.createdAt),
          updatedAt: new Date(host.updatedAt)
        };

        if (existingHost && overwrite) {
          // Update existing host
          const updatedHost = await storage.updateHost(existingHost.id, hostData);
          console.log(`✅ Updated host: ${host.name} (ID: ${updatedHost?.id})`);
        } else {
          // Create new host
          const createdHost = await storage.createHost(hostData);
          console.log(`✅ Created host: ${host.name} (ID: ${createdHost.id})`);
        }

        stats.successful++;

      } catch (error) {
        const errorMsg = `Failed to migrate host ${host.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }

    // Print summary
    console.log('\\n📊 Hosts Migration Summary:');
    console.log(`Total hosts: ${stats.total}`);
    console.log(`✅ Successful: ${stats.successful}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);
    
    if (stats.errors.length > 0) {
      console.log('\\n🚨 Errors:');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }

    return stats;

  } catch (error) {
    console.error('❌ Hosts migration failed:', error);
    throw error;
  }
}

// Preview function
export async function previewHosts(filePath: string = './backup_files/hosts.json'): Promise<void> {
  try {
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const backupHosts: BackupHost[] = JSON.parse(jsonData);
    
    console.log(`📋 Hosts Migration Preview (${backupHosts.length} records):\\n`);
    
    // Check for existing hosts
    const existingHosts = await storage.getAllHosts();
    const existingNames = existingHosts.map(h => h.name.toLowerCase());
    
    const newHosts: string[] = [];
    const duplicateHosts: string[] = [];

    for (const host of backupHosts) {
      if (existingNames.includes(host.name.toLowerCase())) {
        duplicateHosts.push(host.name);
      } else {
        newHosts.push(host.name);
      }
    }

    console.log(`🆕 New hosts to be created: ${newHosts.length}`);
    if (newHosts.length > 0) {
      newHosts.slice(0, 10).forEach(name => console.log(`  - ${name}`));
      if (newHosts.length > 10) {
        console.log(`  ... and ${newHosts.length - 10} more`);
      }
    }

    console.log(`\\n⚠️  Existing hosts that would be skipped: ${duplicateHosts.length}`);
    if (duplicateHosts.length > 0) {
      duplicateHosts.slice(0, 10).forEach(name => console.log(`  - ${name}`));
      if (duplicateHosts.length > 10) {
        console.log(`  ... and ${duplicateHosts.length - 10} more`);
      }
    }

    console.log('\\n💡 To run the migration:');
    console.log('  npm run migrate-hosts');
    console.log('  npm run migrate-hosts -- --overwrite  (to update existing hosts)');

  } catch (error) {
    console.error('❌ Preview failed:', error);
  }
}

// CLI handler
export async function runHostsMigration() {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite') || args.includes('-o');
  const preview = args.includes('--preview') || args.includes('-p');
  const filePath = args.find(arg => arg.endsWith('.json')) || './backup_files/hosts.json';

  console.log('🚀 Starting hosts migration...');
  console.log(`📁 Source file: ${filePath}`);
  console.log(`🔄 Overwrite existing: ${overwrite}`);
  console.log('');

  try {
    if (preview) {
      await previewHosts(filePath);
      console.log('\n✅ Preview completed successfully!');
    } else {
      const stats = await migrateHosts(filePath, overwrite);
      
      if (stats.failed === 0) {
        console.log('\n🎉 Hosts migration completed successfully!');
      } else {
        console.log('\n⚠️  Hosts migration completed with some errors.');
      }
    }
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Hosts migration failed completely:', error);
    process.exit(1);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runHostsMigration();
}
