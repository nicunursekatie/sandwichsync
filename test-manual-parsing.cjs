// Quick test of the manual CSV parsing function
function parseCSVManually(csvContent) {
  const lines = csvContent.split("\n");
  if (lines.length === 0) return [];

  // Get headers from first line
  const headerLine = lines[0];
  const headers = headerLine.split(",").map(h => h.replace(/^"|"$/g, "").trim());

  const records = [];
  
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
      const record = {};
      for (let k = 0; k < headers.length; k++) {
        record[headers[k]] = fields[k] || '';
      }
      records.push(record);
    }
  }

  return records;
}

// Test with the actual CSV content
const fs = require('fs');
const csvContent = fs.readFileSync('/Users/kathrynelong/Downloads/sandwichsync-local/backup_files/sandwich-collections-all-2025-07-07.csv', 'utf-8');

console.log('🧪 Testing manual CSV parsing...');
const records = parseCSVManually(csvContent);
console.log(`✅ Parsed ${records.length} records successfully`);

// Test first few records
console.log('\n📋 First 3 records:');
records.slice(0, 3).forEach((record, i) => {
  console.log(`\nRecord ${i + 1}:`);
  console.log(`  Host Name: ${record['Host Name']}`);
  console.log(`  Individual Sandwiches: ${record['Individual Sandwiches']}`);
  console.log(`  Collection Date: ${record['Collection Date']}`);
  console.log(`  Group Collections: ${record['Group Collections']}`);
});

// Test problematic line with nested JSON
const problematicRecord = records.find(r => r['Group Collections'].includes('{"name"'));
if (problematicRecord) {
  console.log('\n🔍 Found record with nested JSON:');
  console.log(`  Host Name: ${problematicRecord['Host Name']}`);
  console.log(`  Group Collections: ${problematicRecord['Group Collections']}`);
  
  // Test if it's valid JSON
  try {
    JSON.parse(problematicRecord['Group Collections']);
    console.log('  ✅ Group Collections JSON is valid');
  } catch (e) {
    console.log('  ❌ Group Collections JSON is invalid:', e.message);
  }
}

console.log('\n🎉 Manual CSV parsing test completed successfully!');
