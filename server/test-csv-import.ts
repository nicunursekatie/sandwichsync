import 'dotenv/config';
import { parse } from "csv-parse/sync";
import fs from 'fs';

// Manual CSV parsing function to handle complex JSON content within CSV fields
function parseCSVManually(csvContent: string): any[] {
  const lines = csvContent.split("\n");
  if (lines.length === 0) return [];

  // Get headers from first line
  const headerLine = lines[0];
  const headers = headerLine.split(",").map(h => h.replace(/^"|"$/g, "").trim());

  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // For this specific CSV format, we know the structure:
    // ID,Host Name,Individual Sandwiches,Collection Date,Group Collections,Submitted At
    
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
      const record: any = {};
      for (let k = 0; k < headers.length; k++) {
        record[headers[k]] = fields[k] || '';
      }
      records.push(record);
    }
  }

  return records;
}

async function testCsvImport() {
  try {
    console.log('🧪 Testing CSV import with your actual data...');

    // Read the CSV file
    const csvPath = '/Users/kathrynelong/Downloads/sandwichsync-local/backup_files/sandwich-collections-all-2025-07-07.csv';
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    console.log('📄 CSV Content Preview:');
    console.log(csvContent.substring(0, 300) + '...');
    
    // Parse the CSV
    let records;
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
      console.log('⚠️  Standard parsing failed, trying manual parsing...');
      // Fall back to manual parsing for complex cases with nested JSON
      records = parseCSVManually(csvContent);
    }

    console.log(`\n📊 Parsed ${records.length} records`);
    console.log('\n🔍 First few records:');
    
    for (let i = 0; i < Math.min(3, records.length); i++) {
      const record = records[i];
      console.log(`\nRecord ${i + 1}:`);
      console.log(`  ID: ${record.ID}`);
      console.log(`  Host Name: ${record["Host Name"]}`);
      console.log(`  Individual Sandwiches: ${record["Individual Sandwiches"]}`);
      console.log(`  Collection Date: ${record["Collection Date"]}`);
      console.log(`  Group Collections: ${record["Group Collections"]}`);
      console.log(`  Submitted At: ${record["Submitted At"]}`);
      
      // Test field extraction logic
      const hostName = record["Host Name"] || record["Host"] || record["host_name"] || record["HostName"];
      const sandwichCountStr = record["Individual Sandwiches"] || record["Sandwich Count"] || record["Count"];
      const date = record["Collection Date"] || record["Date"] || record["date"];
      
      console.log(`  ✅ Extracted - Host: ${hostName}, Count: ${sandwichCountStr}, Date: ${date}`);
      
      // Test parsing
      const sandwichCount = parseInt(sandwichCountStr?.toString().trim() || '0');
      console.log(`  🔢 Parsed count: ${sandwichCount} (isNaN: ${isNaN(sandwichCount)})`);
    }

    // Test with a few more records to check for issues
    console.log('\n🔍 Checking for potential issues in all records...');
    let issueCount = 0;
    
    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      const hostName = record["Host Name"];
      const sandwichCountStr = record["Individual Sandwiches"];
      const date = record["Collection Date"];
      
      if (!hostName || !sandwichCountStr || !date) {
        issueCount++;
        if (issueCount <= 5) { // Show first 5 issues
          console.log(`❌ Issue in record ${i + 1}:`);
          console.log(`   Host Name: ${hostName || 'MISSING'}`);
          console.log(`   Individual Sandwiches: ${sandwichCountStr || 'MISSING'}`);
          console.log(`   Collection Date: ${date || 'MISSING'}`);
        }
      }
      
      const sandwichCount = parseInt(sandwichCountStr?.toString().trim() || '0');
      if (isNaN(sandwichCount)) {
        console.log(`❌ Invalid sandwich count in record ${i + 1}: "${sandwichCountStr}"`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  Total records: ${records.length}`);
    console.log(`  Records with issues: ${issueCount}`);
    console.log(`  Records that should import successfully: ${records.length - issueCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing CSV import:', error);
    process.exit(1);
  }
}

testCsvImport();
