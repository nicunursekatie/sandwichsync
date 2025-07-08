import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { storage } from './storage-wrapper.js';

interface MigrationStats {
  total: number;
  successful: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface CSVCollection {
  [key: string]: string; // CSV data comes as string key-value pairs
}

interface ProcessedCollection {
  collectionDate: string;
  hostName: string;
  individualSandwiches: number;
  groupCollections: string;
  submittedAt: Date;
  notes?: string;
  rawData?: any; // Store original CSV row for debugging
}

export class CSVCollectionMigrator {
  private csvFilePath: string;
  private stats: MigrationStats = {
    total: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  constructor(csvFilePath: string) {
    this.csvFilePath = csvFilePath;
  }

  // Manual CSV parsing function to handle complex JSON content within CSV fields
  private parseCSVManually(csvContent: string): CSVCollection[] {
    const lines = csvContent.split("\n");
    if (lines.length === 0) return [];

    // Get headers from first line
    const headerLine = lines[0];
    const headers = headerLine.split(",").map(h => h.replace(/^"|"$/g, "").trim());

    const records: CSVCollection[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by comma but be careful with quoted content
      const fields = [];
      let currentField = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          // Handle nested quotes - if we have JSON content with quotes
          if (inQuotes && line[j + 1] === '"') {
            currentField += '"';
            j++; // Skip the next quote
          } else {
            inQuotes = !inQuotes;
            if (!inQuotes || j === 0 || line[j - 1] === ',') {
              // Don't add the quote character to the field content
            } else {
              currentField += char;
            }
          }
        } else if (char === ',' && !inQuotes) {
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      
      // Add the last field
      if (currentField) {
        fields.push(currentField.trim());
      }

      // Create record object
      if (fields.length >= headers.length) {
        const record: CSVCollection = {};
        for (let k = 0; k < headers.length; k++) {
          record[headers[k]] = fields[k] || '';
        }
        records.push(record);
      }
    }

    return records;
  }

  private parseCSVRow(row: CSVCollection): ProcessedCollection | null {
    try {
      // Common CSV column names to look for (case-insensitive)
      const dateFields = ['date', 'collection_date', 'collectiondate', 'collection date', 'Date', 'Collection Date'];
      const hostFields = ['host', 'host_name', 'hostname', 'location', 'Host', 'Host Name', 'Location'];
      const sandwichFields = ['sandwiches', 'individual_sandwiches', 'individual sandwiches', 'count', 'total', 'Sandwiches', 'Individual Sandwiches', 'Count', 'Total'];
      const groupFields = ['groups', 'group_collections', 'group collections', 'Groups', 'Group Collections'];
      const submittedFields = ['submitted', 'submitted_at', 'submitted at', 'timestamp', 'Submitted', 'Submitted At'];

      // Helper function to find field value (case-insensitive)
      const findField = (fields: string[]): string => {
        for (const field of fields) {
          if (row[field] !== undefined) return row[field];
          // Try case-insensitive match
          const key = Object.keys(row).find(k => k.toLowerCase() === field.toLowerCase());
          if (key && row[key] !== undefined) return row[key];
        }
        return '';
      };

      const dateValue = findField(dateFields);
      const hostValue = findField(hostFields);
      const sandwichValue = findField(sandwichFields);
      const groupValue = findField(groupFields);
      const submittedValue = findField(submittedFields);

      if (!dateValue || !hostValue) {
        return null; // Skip rows without essential data
      }

      // Parse date
      let collectionDate = '';
      const parsedDate = new Date(dateValue);
      if (isNaN(parsedDate.getTime())) {
        // Try different date formats
        const dateFormats = [
          // MM/DD/YYYY
          /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
          // DD/MM/YYYY
          /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
          // YYYY-MM-DD
          /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        ];
        
        let dateMatched = false;
        for (const format of dateFormats) {
          const match = dateValue.match(format);
          if (match) {
            if (format.source.startsWith('^(\\d{4})')) {
              // YYYY-MM-DD format
              collectionDate = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
            } else {
              // Assume MM/DD/YYYY format
              const year = match[3];
              const month = match[1].padStart(2, '0');
              const day = match[2].padStart(2, '0');
              collectionDate = `${year}-${month}-${day}`;
            }
            dateMatched = true;
            break;
          }
        }
        
        if (!dateMatched) {
          throw new Error(`Invalid date format: ${dateValue}`);
        }
      } else {
        collectionDate = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      }

      // Parse sandwich count
      const sandwichCount = parseInt(sandwichValue) || 0;

      // Parse group collections (if any)
      let groupCollections = '[]';
      if (groupValue && groupValue.trim()) {
        try {
          // Try to parse as JSON first
          JSON.parse(groupValue);
          groupCollections = groupValue;
        } catch {
          // If not JSON, create a simple group entry
          if (groupValue.toLowerCase() !== 'none' && groupValue !== '0') {
            groupCollections = JSON.stringify([{ name: 'Groups', count: parseInt(groupValue) || 0 }]);
          }
        }
      }

      // Parse submitted date
      let submittedAt = new Date();
      if (submittedValue && submittedValue.trim()) {
        const submittedDate = new Date(submittedValue);
        if (!isNaN(submittedDate.getTime())) {
          submittedAt = submittedDate;
        }
      }

      return {
        collectionDate,
        hostName: hostValue.trim(),
        individualSandwiches: sandwichCount,
        groupCollections,
        submittedAt,
        rawData: row
      };

    } catch (error) {
      console.error(`❌ Error parsing CSV row:`, error);
      console.error(`Row data:`, row);
      return null;
    }
  }

  public async migrateFromCSV(overwrite: boolean = false): Promise<MigrationStats> {
    console.log(`🥪 Starting CSV sandwich collections migration from ${this.csvFilePath}`);
    
    try {
      // Read and parse CSV file with enhanced error handling
      const csvContent = fs.readFileSync(this.csvFilePath, 'utf8');
      let records: CSVCollection[] = [];
      
      try {
        records = parse(csvContent, {
          columns: true, // Use first row as headers
          skip_empty_lines: true,
          trim: true,
          delimiter: ",",
          quote: '"',
          escape: '"',
          relax_quotes: true,
          relax_column_count: true,
        });
      } catch (parseError) {
        console.log('⚠️  Standard parsing failed, using manual parsing...');
        records = this.parseCSVManually(csvContent);
      }

      this.stats.total = records.length;
      console.log(`📊 Found ${this.stats.total} records in CSV file`);

      // Show sample of column headers for debugging
      if (records.length > 0) {
        console.log(`📋 CSV columns found: ${Object.keys(records[0]).join(', ')}`);
        console.log(`📋 Sample row:`, records[0]);
        console.log('');
      }

      // Get existing collections for duplicate checking
      const existingCollections = await storage.getAllSandwichCollections();

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        
        try {
          const processed = this.parseCSVRow(record);
          
          if (!processed) {
            console.log(`⏭️  Skipping row ${i + 1}: Missing essential data`);
            this.stats.skipped++;
            continue;
          }

          // Check for duplicates
          const existingCollection = existingCollections.find(c => 
            c.collectionDate === processed.collectionDate && 
            c.hostName.toLowerCase() === processed.hostName.toLowerCase()
          );

          if (existingCollection && !overwrite) {
            console.log(`⏭️  Skipping existing collection: ${processed.hostName} on ${processed.collectionDate}`);
            this.stats.skipped++;
            continue;
          }

          const collectionData = {
            collectionDate: processed.collectionDate,
            hostName: processed.hostName,
            individualSandwiches: processed.individualSandwiches,
            groupCollections: processed.groupCollections,
            submittedAt: processed.submittedAt
          };

          if (existingCollection && overwrite) {
            // Update existing collection
            const updatedCollection = await storage.updateSandwichCollection(existingCollection.id, collectionData);
            console.log(`✅ Updated collection: ${processed.hostName} - ${processed.individualSandwiches} sandwiches on ${processed.collectionDate}`);
          } else {
            // Create new collection
            const createdCollection = await storage.createSandwichCollection(collectionData);
            console.log(`✅ Created collection: ${processed.hostName} - ${processed.individualSandwiches} sandwiches on ${processed.collectionDate}`);
          }

          this.stats.successful++;

        } catch (error) {
          const errorMsg = `Failed to migrate row ${i + 1}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`❌ ${errorMsg}`);
          console.error(`Row data:`, record);
          this.stats.errors.push(errorMsg);
          this.stats.failed++;
        }
      }

      this.printSummary();
      return this.stats;

    } catch (error) {
      console.error('❌ CSV migration failed:', error);
      throw error;
    }
  }

  public async previewCSV(): Promise<void> {
    console.log(`📋 CSV MIGRATION PREVIEW`);
    console.log('='.repeat(50));

    try {
      const csvContent = fs.readFileSync(this.csvFilePath, 'utf8');
      let records: CSVCollection[] = [];
      
      try {
        records = parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          delimiter: ",",
          quote: '"',
          escape: '"',
          relax_quotes: true,
          relax_column_count: true,
        });
      } catch (parseError) {
        console.log('⚠️  Standard parsing failed, using manual parsing...');
        records = this.parseCSVManually(csvContent);
      }

      console.log(`\\n📊 Found ${records.length} records in CSV file`);
      if (records.length > 0) {
        console.log(`📋 CSV columns: ${Object.keys(records[0]).join(', ')}`);

        // Show first few rows
        console.log('\\n📋 First 3 rows:');
        records.slice(0, 3).forEach((row, i) => {
          console.log(`\\nRow ${i + 1}:`);
          Object.entries(row).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });
        });

        // Try to process a few rows to show what would be created
        console.log('\\n🔍 Processing preview:');
        let processedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < Math.min(5, records.length); i++) {
          const processed = this.parseCSVRow(records[i]);
          if (processed) {
            console.log(`✅ Row ${i + 1}: ${processed.hostName} - ${processed.individualSandwiches} sandwiches on ${processed.collectionDate}`);
            processedCount++;
          } else {
            console.log(`❌ Row ${i + 1}: Could not process`);
            errorCount++;
          }
        }

        console.log(`\\n📊 Preview summary:`);
        console.log(`Total rows: ${records.length}`);
        console.log(`Sample processed: ${processedCount}/${Math.min(5, records.length)}`);
        console.log(`Sample errors: ${errorCount}/${Math.min(5, records.length)}`);
      }

    } catch (error) {
      console.error('❌ Preview failed:', error);
      throw error;
    }
  }

  private printSummary(): void {
    console.log('\\n📊 CSV MIGRATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total records: ${this.stats.total}`);
    console.log(`✅ Successful: ${this.stats.successful}`);
    console.log(`⏭️  Skipped: ${this.stats.skipped}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    
    if (this.stats.errors.length > 0) {
      console.log('\\n🚨 Errors:');
      this.stats.errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
      if (this.stats.errors.length > 10) {
        console.log(`  ... and ${this.stats.errors.length - 10} more errors`);
      }
    }

    if (this.stats.failed === 0) {
      console.log('\\n🎉 CSV migration completed successfully!');
    } else {
      console.log('\\n⚠️  CSV migration completed with some errors.');
    }
  }
}

// CLI handler
export async function runCSVMigration() {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite') || args.includes('-o');
  const preview = args.includes('--preview') || args.includes('-p');
  
  // Find CSV file path in arguments
  const csvPath = args.find(arg => arg.endsWith('.csv')) || './sandwich-collections.csv';

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}`);
    console.log('Usage: npm run migrate-csv-collections <csv-file-path>');
    console.log('Example: npm run migrate-csv-collections ./data/collections.csv');
    process.exit(1);
  }

  const migrator = new CSVCollectionMigrator(csvPath);

  try {
    if (preview) {
      await migrator.previewCSV();
      console.log('\\n✅ Preview completed!');
    } else {
      console.log(`🚀 Starting CSV migration from ${csvPath}`);
      console.log(`🔄 Overwrite existing: ${overwrite}`);
      console.log('');
      
      await migrator.migrateFromCSV(overwrite);
      console.log('\\n✅ CSV migration completed!');
    }
    process.exit(0);
  } catch (error) {
    console.error('\\n💥 CSV migration failed:', error);
    process.exit(1);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runCSVMigration();
}
