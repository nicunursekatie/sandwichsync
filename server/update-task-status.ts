import 'dotenv/config';
import { db } from './db.js';
import { projectTasks } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function updateTaskStatus() {
  try {
    console.log('🔄 Updating task status...');

    const taskId = 3;
    
    // Update the task status from "completed" to "waiting"
    const result = await db
      .update(projectTasks)
      .set({ 
        status: 'waiting',
        updatedAt: new Date()
      })
      .where(eq(projectTasks.id, taskId));

    console.log(`✅ Updated task ${taskId} status to "waiting"`);
    console.log('✅ Task completion migration fully fixed!');
    
    console.log('\n🎯 Now the UI should show:');
    console.log('  📋 Task: "Test out direct messaging"');
    console.log('  🔄 Status: "Waiting" (medium priority)');
    console.log('  📊 Team Progress: 1/4');
    console.log('  ✅ Katie Long: Done');
    console.log('  ○ Others: Pending');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateTaskStatus();
