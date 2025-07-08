import 'dotenv/config';
import { storage } from './storage-wrapper.js';
import { db } from './db.js';
import { taskCompletions } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function fixTaskCompletionDisplay() {
  try {
    console.log('🔧 Fixing task completion display...');

    // Find the direct messaging task (ID 3)
    const taskId = 3;
    console.log(`\nChecking task completions for task ID: ${taskId}`);

    // Query task completions directly from database
    const completions = await db
      .select()
      .from(taskCompletions)
      .where(eq(taskCompletions.taskId, taskId));

    console.log(`Found ${completions.length} completions for task ${taskId}:`);
    completions.forEach(completion => {
      console.log(`  ID: ${completion.id}`);
      console.log(`  User ID: ${completion.userId}`);
      console.log(`  User Name: ${completion.userName}`);
      console.log(`  Completed At: ${completion.completedAt}`);
      console.log(`  Notes: ${completion.notes || 'None'}`);
      console.log('  ---');
    });

    // Get the task details
    const projects = await storage.getAllProjects();
    const testSandwichProject = projects.find(p => p.title === "Test Sandwich Project Platform");
    const tasks = await storage.getProjectTasks(testSandwichProject!.id);
    const directMessagingTask = tasks.find(t => t.id === taskId);

    if (!directMessagingTask) {
      console.log('❌ Task not found');
      return;
    }

    console.log(`\n📋 Task Details:`);
    console.log(`  Task ID: ${directMessagingTask.id}`);
    console.log(`  Title: "${directMessagingTask.title}"`);
    console.log(`  Status: ${directMessagingTask.status}`);
    console.log(`  Assignees: ${directMessagingTask.assigneeIds?.length || 0}`);

    // Check if we need to update task status
    const totalAssignees = directMessagingTask.assigneeIds?.length || 0;
    const completedCount = completions.length;
    const shouldBeWaiting = completedCount < totalAssignees;

    console.log(`\n📊 Completion Analysis:`);
    console.log(`  Total assignees: ${totalAssignees}`);
    console.log(`  Completed: ${completedCount}`);
    console.log(`  Should be waiting: ${shouldBeWaiting}`);

    // If task status needs to be fixed
    if (shouldBeWaiting && directMessagingTask.status === 'completed') {
      console.log(`\n🔄 Task status should be "waiting", not "completed"`);
      console.log(`   Current: "${directMessagingTask.status}"`);
      console.log(`   Should be: "waiting"`);
      
      // Update task status (this would need an updateProjectTask method)
      console.log('⚠️  Manual task status update needed in the UI');
    }

    // Check if completion data exists for Katie Long
    const katieCompletion = completions.find(c => 
      c.userId === 'committee_1751934328437' ||
      c.userName?.includes('katielong2316') ||
      c.userName?.includes('Katie Long')
    );

    if (katieCompletion) {
      console.log(`\n✅ Found Katie Long's completion:`);
      console.log(`   User ID: ${katieCompletion.userId}`);
      console.log(`   Completed At: ${katieCompletion.completedAt}`);
      console.log(`   This should show as ✅ Done in the UI`);
    } else {
      console.log(`\n❌ Katie Long's completion not found`);
      console.log(`   Need to create completion for user: committee_1751934328437`);
      
      // Create the missing completion
      try {
        const newCompletion = {
          taskId: taskId,
          userId: 'committee_1751934328437',
          userName: 'Katie Long',
          completedAt: new Date('2025-07-06T16:21:54.298Z'),
          notes: null
        };

        const result = await db.insert(taskCompletions).values(newCompletion);
        console.log('✅ Created Katie Long completion record');
      } catch (error) {
        console.log('❌ Error creating completion:', error);
      }
    }

    // Summary of what should show in UI
    console.log(`\n🎯 Expected UI Display:`);
    console.log(`  Task Status: "Waiting" (medium priority)`);
    console.log(`  Team Progress: 1/4 (if Katie's completion exists)`);
    console.log(`  Katie Long: ✅ Done`);
    console.log(`  Others: ○ Pending`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixTaskCompletionDisplay();
