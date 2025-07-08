import 'dotenv/config';
import { CSVCollectionMigrator } from './migrate-csv-collections.js';

async function testActualImport() {
  try {
    console.log('🧪 Testing actual CSV import functionality...');

    const csvPath = '/Users/kathrynelong/Downloads/sandwichsync-local/backup_files/sandwich-collections-all-2025-07-07.csv';
    const migrator = new CSVCollectionMigrator(csvPath);

    // Preview first to see what would be imported
    console.log('\n📋 Preview mode first...');
    await migrator.previewCSV();

    console.log('\n🚀 Running actual migration (first 10 records only for testing)...');
    // For testing, we'll create a sample file with just the first few records
    
    const fs = await import('fs');
    const originalContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = originalContent.split('\n');
    const sampleContent = [lines[0], ...lines.slice(1, 11)].join('\n'); // Header + first 10 records
    
    const testPath = '/tmp/test-sample.csv';
    fs.writeFileSync(testPath, sampleContent);
    
    const testMigrator = new CSVCollectionMigrator(testPath);
    const result = await testMigrator.migrateFromCSV(false); // Don't overwrite
    
    console.log('\n✅ Test migration completed!');
    console.log(`Processed: ${result.successful}/${result.total} records`);
    if (result.errors.length > 0) {
      console.log('Errors:', result.errors);
    }
    
    // Clean up test file
    fs.unlinkSync(testPath);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testActualImport();
