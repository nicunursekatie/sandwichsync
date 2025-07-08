import { Pool } from 'pg';

async function addAdminToGeneral() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:fvuLFKlmuiLoecmddQUfkpsHWeHJQaFw@yamabiko.proxy.rlwy.net:42218/railway'
  });

  try {
    console.log('🔍 Checking current participants in conversation 1...');
    
    const participantsResult = await pool.query(`
      SELECT cp.*, u.email 
      FROM conversation_participants cp 
      JOIN users u ON cp.user_id = u.id 
      WHERE cp.conversation_id = 1
    `);
    console.log('👥 Current participants:', participantsResult.rows);
    
    console.log('🔍 Checking if admin user exists...');
    const adminResult = await pool.query("SELECT * FROM users WHERE id = 'admin'");
    console.log('👤 Admin user:', adminResult.rows);
    
    if (adminResult.rows.length === 0) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    console.log('➕ Adding admin to conversation 1...');
    await pool.query(`
      INSERT INTO conversation_participants (conversation_id, user_id) 
      VALUES (1, 'admin')
      ON CONFLICT (conversation_id, user_id) DO NOTHING
    `);
    
    console.log('✅ Admin user added to conversation 1!');
    
    // Verify
    const newParticipantsResult = await pool.query(`
      SELECT cp.*, u.email 
      FROM conversation_participants cp 
      JOIN users u ON cp.user_id = u.id 
      WHERE cp.conversation_id = 1
    `);
    console.log('👥 Updated participants:', newParticipantsResult.rows);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

addAdminToGeneral();
