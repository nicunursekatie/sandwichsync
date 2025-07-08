import { Pool } from 'pg';

async function checkConversations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/sandwichsync_dev'
  });

  try {
    console.log('🔍 Checking conversations...');
    
    const conversationsResult = await pool.query('SELECT * FROM conversations ORDER BY created_at');
    console.log('📊 Conversations:', conversationsResult.rows);
    
    const participantsResult = await pool.query(`
      SELECT cp.*, u.email, c.name as conversation_name 
      FROM conversation_participants cp 
      JOIN users u ON cp.user_id = u.id 
      JOIN conversations c ON cp.conversation_id = c.id
      ORDER BY cp.conversation_id
    `);
    console.log('👥 Participants:', participantsResult.rows);
    
    const usersResult = await pool.query('SELECT id, email, permissions FROM users');
    console.log('👤 Users:', usersResult.rows);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkConversations();
