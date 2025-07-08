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

interface BackupRecipient {
  id: number;
  name: string;
  contactName: string | null;
  phone: string;
  email: string;
  address: string;
  preferences: string;
  weeklyEstimate: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export async function migrateRecipients(filePath: string = './backup_files/recipients.json', overwrite: boolean = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    console.log(`🎯 Starting recipients migration from ${filePath}`);
    
    // Read and parse the recipients.json file
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const backupRecipients: BackupRecipient[] = JSON.parse(jsonData);
    
    stats.total = backupRecipients.length;
    console.log(`📊 Found ${stats.total} recipients to migrate`);

    for (const recipient of backupRecipients) {
      try {
        // Check if recipient already exists by name
        const existingRecipients = await storage.getAllRecipients();
        const existingRecipient = existingRecipients.find(r => r.name.toLowerCase() === recipient.name.toLowerCase());

        if (existingRecipient && !overwrite) {
          console.log(`⏭️  Skipping existing recipient: ${recipient.name}`);
          stats.skipped++;
          continue;
        }

        const recipientData = {
          name: recipient.name,
          contactName: recipient.contactName,
          phone: recipient.phone,
          email: recipient.email,
          address: recipient.address,
          preferences: recipient.preferences,
          weeklyEstimate: recipient.weeklyEstimate,
          status: recipient.status || 'active',
          createdAt: new Date(recipient.createdAt),
          updatedAt: new Date(recipient.updatedAt)
        };

        if (existingRecipient && overwrite) {
          // Update existing recipient
          const updatedRecipient = await storage.updateRecipient(existingRecipient.id, recipientData);
          console.log(`✅ Updated recipient: ${recipient.name} (ID: ${updatedRecipient?.id})`);
        } else {
          // Create new recipient
          const createdRecipient = await storage.createRecipient(recipientData);
          console.log(`✅ Created recipient: ${recipient.name} (ID: ${createdRecipient.id})`);
        }

        stats.successful++;

      } catch (error) {
        const errorMsg = `Failed to migrate recipient ${recipient.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }

    // Print summary
    console.log('\\n📊 Recipients Migration Summary:');
    console.log(`Total recipients: ${stats.total}`);
    console.log(`✅ Successful: ${stats.successful}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);
    
    if (stats.errors.length > 0) {
      console.log('\\n🚨 Errors:');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }

    return stats;

  } catch (error) {
    console.error('❌ Recipients migration failed:', error);
    throw error;
  }
}

// Preview function
export async function previewRecipients(filePath: string = './backup_files/recipients.json'): Promise<void> {
  try {
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const backupRecipients: BackupRecipient[] = JSON.parse(jsonData);
    
    console.log(`📋 Recipients Migration Preview (${backupRecipients.length} records):\\n`);
    
    // Check for existing recipients
    const existingRecipients = await storage.getAllRecipients();
    const existingNames = existingRecipients.map(r => r.name.toLowerCase());
    
    const newRecipients: string[] = [];
    const duplicateRecipients: string[] = [];

    for (const recipient of backupRecipients) {
      if (existingNames.includes(recipient.name.toLowerCase())) {
        duplicateRecipients.push(recipient.name);
      } else {
        newRecipients.push(recipient.name);
      }
    }

    console.log(`🆕 New recipients to be created: ${newRecipients.length}`);
    if (newRecipients.length > 0) {
      newRecipients.slice(0, 10).forEach(name => console.log(`  - ${name}`));
      if (newRecipients.length > 10) {
        console.log(`  ... and ${newRecipients.length - 10} more`);
      }
    }

    console.log(`\\n⚠️  Existing recipients that would be skipped: ${duplicateRecipients.length}`);
    if (duplicateRecipients.length > 0) {
      duplicateRecipients.slice(0, 10).forEach(name => console.log(`  - ${name}`));
      if (duplicateRecipients.length > 10) {
        console.log(`  ... and ${duplicateRecipients.length - 10} more`);
      }
    }

    // Show sample data structure
    if (backupRecipients.length > 0) {
      const sample = backupRecipients[0];
      console.log('\\n📋 Sample recipient data:');
      console.log(`  Name: ${sample.name}`);
      console.log(`  Contact: ${sample.contactName || 'N/A'}`);
      console.log(`  Phone: ${sample.phone}`);
      console.log(`  Email: ${sample.email}`);
      console.log(`  Weekly Estimate: ${sample.weeklyEstimate || 'N/A'}`);
      console.log(`  Status: ${sample.status}`);
    }

    console.log('\\n💡 To run the migration:');
    console.log('  npm run migrate-recipients');
    console.log('  npm run migrate-recipients -- --overwrite  (to update existing recipients)');

  } catch (error) {
    console.error('❌ Preview failed:', error);
  }
}

// CLI handler
export async function runRecipientsMigration() {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite') || args.includes('-o');
  const preview = args.includes('--preview') || args.includes('-p');
  const filePath = args.find(arg => arg.endsWith('.json')) || './backup_files/recipients.json';

  console.log('🚀 Starting recipients migration...');
  console.log(`📁 Source file: ${filePath}`);
  console.log(`🔄 Overwrite existing: ${overwrite}`);
  console.log('');

  try {
    if (preview) {
      await previewRecipients(filePath);
    } else {
      const stats = await migrateRecipients(filePath, overwrite);
      
      if (stats.failed === 0) {
        console.log('\\n🎉 Recipients migration completed successfully!');
      } else {
        console.log('\\n⚠️  Recipients migration completed with some errors.');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('\\n💥 Recipients migration failed completely:', error);
    process.exit(1);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite') || args.includes('-o');
  const preview = args.includes('--preview') || args.includes('-p');

  console.log('🚀 Starting recipients migration...');
  console.log('');

  if (preview) {
    previewRecipients().then(() => {
      console.log('\n✅ Preview completed!');
      process.exit(0);
    }).catch(error => {
      console.error('\n💥 Preview failed:', error);
      process.exit(1);
    });
  } else {
    migrateRecipients('./backup_files/recipients.json', overwrite).then(() => {
      console.log('\n✅ Migration completed!');
      process.exit(0);
    }).catch(error => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    });
  }
}
