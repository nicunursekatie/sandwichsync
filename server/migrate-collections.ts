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

interface BackupSandwichCollection {
  id: number;
  collectionDate: string;
  hostName: string;
  individualSandwiches: number;
  groupCollections: string;
  submittedAt: string;
}

export async function migrateSandwichCollections(filePath: string = './backup_files/sandwich-collections.json', overwrite: boolean = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    console.log(`🥪 Starting sandwich collections migration from ${filePath}`);
    
    // Read and parse the sandwich-collections.json file
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const fileData = JSON.parse(jsonData);
    
    // The file has a "collections" property containing the array
    const backupCollections: BackupSandwichCollection[] = fileData.collections || [];
    
    stats.total = backupCollections.length;
    console.log(`📊 Found ${stats.total} sandwich collections to migrate`);

    for (const collection of backupCollections) {
      try {
        // Check if collection already exists by date and host name
        const existingCollections = await storage.getAllSandwichCollections();
        const existingCollection = existingCollections.find(c => 
          c.collectionDate === collection.collectionDate && 
          c.hostName.toLowerCase() === collection.hostName.toLowerCase()
        );

        if (existingCollection && !overwrite) {
          console.log(`⏭️  Skipping existing collection: ${collection.hostName} on ${collection.collectionDate}`);
          stats.skipped++;
          continue;
        }

        const collectionData = {
          collectionDate: collection.collectionDate,
          hostName: collection.hostName,
          individualSandwiches: collection.individualSandwiches,
          groupCollections: collection.groupCollections,
          submittedAt: new Date(collection.submittedAt)
        };

        if (existingCollection && overwrite) {
          // Update existing collection
          const updatedCollection = await storage.updateSandwichCollection(existingCollection.id, collectionData);
          console.log(`✅ Updated collection: ${collection.hostName} - ${collection.individualSandwiches} sandwiches on ${collection.collectionDate}`);
        } else {
          // Create new collection
          const createdCollection = await storage.createSandwichCollection(collectionData);
          console.log(`✅ Created collection: ${collection.hostName} - ${collection.individualSandwiches} sandwiches on ${collection.collectionDate}`);
        }

        stats.successful++;

      } catch (error) {
        const errorMsg = `Failed to migrate collection ${collection.hostName} ${collection.collectionDate}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }

    // Print summary
    console.log('\\n📊 Sandwich Collections Migration Summary:');
    console.log(`Total collections: ${stats.total}`);
    console.log(`✅ Successful: ${stats.successful}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);
    
    if (stats.errors.length > 0) {
      console.log('\\n🚨 Errors:');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }

    return stats;

  } catch (error) {
    console.error('❌ Sandwich collections migration failed:', error);
    throw error;
  }
}

// Preview function
export async function previewSandwichCollections(filePath: string = './backup_files/sandwich-collections.json'): Promise<void> {
  try {
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const fileData = JSON.parse(jsonData);
    const backupCollections: BackupSandwichCollection[] = fileData.collections || [];
    
    console.log(`📋 Sandwich Collections Migration Preview (${backupCollections.length} records):\\n`);
    
    // Calculate totals
    const totalSandwiches = backupCollections.reduce((sum, c) => sum + c.individualSandwiches, 0);
    const hostCounts: Record<string, number> = {};
    const dateRange = {
      earliest: '',
      latest: ''
    };

    for (const collection of backupCollections) {
      hostCounts[collection.hostName] = (hostCounts[collection.hostName] || 0) + 1;
      
      if (!dateRange.earliest || collection.collectionDate < dateRange.earliest) {
        dateRange.earliest = collection.collectionDate;
      }
      if (!dateRange.latest || collection.collectionDate > dateRange.latest) {
        dateRange.latest = collection.collectionDate;
      }
    }

    console.log(`🥪 Total sandwiches recorded: ${totalSandwiches.toLocaleString()}`);
    console.log(`📅 Date range: ${dateRange.earliest} to ${dateRange.latest}`);
    
    console.log(`\\n🏠 Collections by host:`);
    Object.entries(hostCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([host, count]) => {
        console.log(`  ${host}: ${count} collections`);
      });

    // Check for existing collections
    const existingCollections = await storage.getAllSandwichCollections();
    const existingKeys = existingCollections.map(c => `${c.collectionDate}-${c.hostName.toLowerCase()}`);
    
    const newCollections: string[] = [];
    const duplicateCollections: string[] = [];

    for (const collection of backupCollections) {
      const key = `${collection.collectionDate}-${collection.hostName.toLowerCase()}`;
      if (existingKeys.includes(key)) {
        duplicateCollections.push(`${collection.hostName} on ${collection.collectionDate}`);
      } else {
        newCollections.push(`${collection.hostName} on ${collection.collectionDate}`);
      }
    }

    console.log(`\\n🆕 New collections to be created: ${newCollections.length}`);
    console.log(`⚠️  Existing collections that would be skipped: ${duplicateCollections.length}`);

    // Show sample data structure
    if (backupCollections.length > 0) {
      const sample = backupCollections[0];
      console.log('\\n📋 Sample collection data:');
      console.log(`  Date: ${sample.collectionDate}`);
      console.log(`  Host: ${sample.hostName}`);
      console.log(`  Individual Sandwiches: ${sample.individualSandwiches}`);
      console.log(`  Group Collections: ${sample.groupCollections}`);
      console.log(`  Submitted At: ${sample.submittedAt}`);
    }

    console.log('\\n💡 To run the migration:');
    console.log('  npm run migrate-collections');
    console.log('  npm run migrate-collections -- --overwrite  (to update existing collections)');

  } catch (error) {
    console.error('❌ Preview failed:', error);
  }
}

// CLI handler
export async function runSandwichCollectionsMigration() {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite') || args.includes('-o');
  const preview = args.includes('--preview') || args.includes('-p');
  const filePath = args.find(arg => arg.endsWith('.json')) || './backup_files/sandwich-collections.json';

  console.log('🚀 Starting sandwich collections migration...');
  console.log(`📁 Source file: ${filePath}`);
  console.log(`🔄 Overwrite existing: ${overwrite}`);
  console.log('');

  try {
    if (preview) {
      await previewSandwichCollections(filePath);
    } else {
      const stats = await migrateSandwichCollections(filePath, overwrite);
      
      if (stats.failed === 0) {
        console.log('\\n🎉 Sandwich collections migration completed successfully!');
      } else {
        console.log('\\n⚠️  Sandwich collections migration completed with some errors.');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('\\n💥 Sandwich collections migration failed completely:', error);
    process.exit(1);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite') || args.includes('-o');
  const preview = args.includes('--preview') || args.includes('-p');

  console.log('🚀 Starting sandwich collections migration...');
  console.log('');

  if (preview) {
    previewSandwichCollections().then(() => {
      console.log('\n✅ Preview completed!');
      process.exit(0);
    }).catch(error => {
      console.error('\n💥 Preview failed:', error);
      process.exit(1);
    });
  } else {
    migrateSandwichCollections('./backup_files/sandwich-collections.json', overwrite).then(() => {
      console.log('\n✅ Migration completed!');
      process.exit(0);
    }).catch(error => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    });
  }
}
