import { db } from './server/db.js';
import { conversations, messages, conversationParticipants } from './shared/schema.js';

async function checkConversations() {
  try {
    console.log('🔍 Checking conversations in database...');
    const allConversations = await db.select().from(conversations);
    console.log('Conversations found:', allConversations.length);
    allConversations.forEach((conv, i) => {
      console.log(`${i + 1}. ${conv.name} (${conv.type}) - ID: ${conv.id}`);
    });

    console.log('\n🔍 Checking conversation participants...');
    const allParticipants = await db.select().from(conversationParticipants);
    console.log('Participants found:', allParticipants.length);

    console.log('\n🔍 Checking messages...');
    const allMessages = await db.select().from(messages);
    console.log('Messages found:', allMessages.length);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkConversations();
