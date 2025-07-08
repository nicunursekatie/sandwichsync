import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BACKUP_DIR = './backup_files';

async function migrateConversationsData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/sandwichsync_dev'
  });

  try {
    console.log('🚀 Starting conversation data migration...');

    // Read the conversation and user data
    const conversationsPath = path.join(BACKUP_DIR, 'conversations.json');
    const usersPath = path.join(BACKUP_DIR, 'users.json');
    
    const conversationsData = JSON.parse(fs.readFileSync(conversationsPath, 'utf8'));
    const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    
    console.log(`📋 Found ${conversationsData.length} conversations to migrate`);
    console.log(`👥 Found ${usersData.length} users in backup`);

    // First, let's see what's currently in the database
    console.log('\n🔍 Current database state:');
    const currentConversations = await pool.query('SELECT * FROM conversations ORDER BY id');
    console.log(`📋 Current conversations: ${currentConversations.rows.length}`);
    currentConversations.rows.forEach(conv => {
      console.log(`  - ID ${conv.id}: ${conv.name} (${conv.type})`);
    });

    const currentUsers = await pool.query('SELECT id, email, role FROM users ORDER BY id');
    console.log(`👥 Current users: ${currentUsers.rows.length}`);
    currentUsers.rows.forEach(user => {
      console.log(`  - ${user.id}: ${user.email} (${user.role})`);
    });

    // Group conversations by type
    const channelConversations = conversationsData.filter(conv => conv.type === 'channel');
    const directConversations = conversationsData.filter(conv => conv.type === 'direct');
    const groupConversations = conversationsData.filter(conv => conv.type === 'group');

    console.log(`\n📊 Conversation breakdown:`);
    console.log(`  - Channel conversations: ${channelConversations.length}`);
    console.log(`  - Direct conversations: ${directConversations.length}`);
    console.log(`  - Group conversations: ${groupConversations.length}`);

    // Migrate channel conversations first (these are the most important)
    console.log('\n🏷️ Migrating channel conversations...');
    for (const conv of channelConversations) {
      console.log(`\n📝 Processing: ${conv.name} (ID: ${conv.id})`);
      
      // Check if conversation already exists
      const existingConv = await pool.query(
        'SELECT * FROM conversations WHERE id = $1', 
        [conv.id]
      );

      if (existingConv.rows.length > 0) {
        console.log(`  ⚠️ Conversation ${conv.id} already exists, skipping...`);
        continue;
      }

      // Insert conversation with original ID
      await pool.query(`
        INSERT INTO conversations (id, type, name, created_at) 
        VALUES ($1, $2, $3, $4)
      `, [conv.id, conv.type, conv.name, conv.createdAt]);
      
      console.log(`  ✅ Created conversation: ${conv.name}`);

      // Add participants based on permissions
      const participantsAdded = await addParticipantsToChannelConversation(pool, conv, currentUsers.rows);
      console.log(`  👥 Added ${participantsAdded} participants`);
    }

    // Migrate group conversations
    console.log('\n👥 Migrating group conversations...');
    for (const conv of groupConversations) {
      console.log(`\n📝 Processing group: ${conv.name} (ID: ${conv.id})`);
      
      const existingConv = await pool.query(
        'SELECT * FROM conversations WHERE id = $1', 
        [conv.id]
      );

      if (existingConv.rows.length > 0) {
        console.log(`  ⚠️ Group ${conv.id} already exists, skipping...`);
        continue;
      }

      await pool.query(`
        INSERT INTO conversations (id, type, name, created_at) 
        VALUES ($1, $2, $3, $4)
      `, [conv.id, conv.type, conv.name, conv.createdAt]);
      
      console.log(`  ✅ Created group: ${conv.name}`);
      
      // For groups, add admin users initially
      const adminUsers = currentUsers.rows.filter(user => 
        user.role === 'admin' || user.role === 'super_admin'
      );
      
      for (const user of adminUsers) {
        await pool.query(`
          INSERT INTO conversation_participants (conversation_id, user_id) 
          VALUES ($1, $2) 
          ON CONFLICT (conversation_id, user_id) DO NOTHING
        `, [conv.id, user.id]);
      }
      
      console.log(`  👥 Added ${adminUsers.length} admin participants`);
    }

    // Reset the conversation ID sequence to avoid conflicts
    const maxId = Math.max(...conversationsData.map(c => c.id));
    await pool.query(`SELECT setval('conversations_id_seq', $1, true)`, [maxId]);
    console.log(`\n🔧 Reset conversation ID sequence to ${maxId}`);

    console.log('\n🎉 Migration completed successfully!');
    
    // Final summary
    const finalConversations = await pool.query('SELECT * FROM conversations ORDER BY id');
    console.log(`\n📊 Final state: ${finalConversations.rows.length} conversations in database`);
    
    return {
      migrated: channelConversations.length + groupConversations.length,
      total: conversationsData.length
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

async function addParticipantsToChannelConversation(pool, conversation, currentUsers) {
  let participantsAdded = 0;
  
  // Define permission mappings for each channel
  const channelPermissions = {
    'General Chat': ['general_chat'],
    'Core Team': ['core_team_chat'],
    'Host Chat': ['host_chat'],
    'Driver Chat': ['driver_chat'],
    'Recipient Chat': ['recipient_chat'],
    'Marketing Committee': ['committee_chat']
  };

  const requiredPermissions = channelPermissions[conversation.name] || [];
  
  console.log(`    🔑 Required permissions for ${conversation.name}: ${requiredPermissions.join(', ')}`);

  for (const user of currentUsers) {
    const userPermissions = await pool.query(
      'SELECT permissions FROM users WHERE id = $1', 
      [user.id]
    );
    
    if (userPermissions.rows.length === 0) continue;
    
    const permissions = userPermissions.rows[0].permissions || [];
    const hasPermission = requiredPermissions.some(perm => permissions.includes(perm)) || 
                         permissions.includes('super_admin') ||
                         user.role === 'admin' || 
                         user.role === 'super_admin';

    if (hasPermission) {
      await pool.query(`
        INSERT INTO conversation_participants (conversation_id, user_id) 
        VALUES ($1, $2) 
        ON CONFLICT (conversation_id, user_id) DO NOTHING
      `, [conversation.id, user.id]);
      
      participantsAdded++;
      console.log(`    ✅ Added ${user.email} to ${conversation.name}`);
    }
  }

  return participantsAdded;
}

// Run the migration
async function main() {
  try {
    const result = await migrateConversationsData();
    console.log(`\n🎯 Migration summary: ${result.migrated}/${result.total} conversations migrated`);
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { migrateConversationsData };
