import 'dotenv/config';
import { storage } from './storage-wrapper.js';

async function checkTaskCompletions() {
  try {
    console.log('🔍 Checking task completion data...');

    // Get the Test Sandwich Project Platform project
    const projects = await storage.getAllProjects();
    const testSandwichProject = projects.find(p => p.title === "Test Sandwich Project Platform");
    
    if (!testSandwichProject) {
      throw new Error('Test Sandwich Project Platform not found');
    }

    console.log(`Found project: "${testSandwichProject.title}" (ID: ${testSandwichProject.id})`);

    // Get tasks for this project
    const tasks = await storage.getProjectTasks(testSandwichProject.id);
    console.log(`\nTasks in project: ${tasks.length}`);
    
    tasks.forEach(task => {
      console.log(`  Task ID: ${task.id} - "${task.title}"`);
      console.log(`    Status: ${task.status}`);
      console.log(`    Assignees: ${task.assigneeIds?.length || 0}`);
    });

    // Find the direct messaging task
    const directMessagingTask = tasks.find(t => 
      t.title.toLowerCase().includes('direct messaging') || 
      t.title.toLowerCase().includes('messaging')
    );

    if (!directMessagingTask) {
      console.log('❌ Direct messaging task not found');
      return;
    }

    console.log(`\n📋 Direct Messaging Task Details:`);
    console.log(`  Task ID: ${directMessagingTask.id}`);
    console.log(`  Title: "${directMessagingTask.title}"`);
    console.log(`  Status: ${directMessagingTask.status}`);
    console.log(`  Assignee IDs: ${JSON.stringify(directMessagingTask.assigneeIds)}`);

    // Check task completions for this task
    console.log(`\n✅ Checking task completions...`);
    
    try {
      // This depends on storage having a method to get task completions
      // We might need to check the database directly
      console.log(`Looking for completions for task ID: ${directMessagingTask.id}`);
      
      // Get all users to map IDs to names
      const users = await storage.getAllUsers();
      console.log(`\n👥 Available users: ${users.length}`);
      
      users.forEach(user => {
        console.log(`  ${user.id}: ${user.firstName} ${user.lastName} (${user.email})`);
      });

      // Try to find Katie Long's user ID
      const katieUser = users.find(u => 
        u.email === 'katielong2316@gmail.com' || 
        (u.firstName === 'Katie' && u.lastName === 'Long')
      );

      if (katieUser) {
        console.log(`\n🎯 Found Katie Long: ${katieUser.id} (${katieUser.email})`);
        console.log(`   Should have completion data for task ${directMessagingTask.id}`);
      } else {
        console.log(`\n❌ Katie Long not found in users`);
      }

      // Check if the task should be marked as "waiting" instead of "completed"
      console.log(`\n📊 Task Status Analysis:`);
      console.log(`  Current status: "${directMessagingTask.status}"`);
      console.log(`  Should be: "waiting" (since not all users completed)`);
      console.log(`  Expected completions: Katie Long should be marked as done`);

    } catch (error) {
      console.log(`❌ Error checking completions: ${error}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTaskCompletions();
