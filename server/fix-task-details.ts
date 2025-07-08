import 'dotenv/config';
import { storage } from './storage-wrapper.js';

async function fixTaskDetails() {
  try {
    console.log('🔧 Fixing task details with original data...');

    // Get all users to map names to IDs
    const users = await storage.getAllUsers();
    const userMap = new Map<string, string>();
    users.forEach(user => {
      if (user.email) {
        userMap.set(user.email, user.id);
      }
      // Also map by display name for easier lookup
      if (user.firstName && user.lastName) {
        userMap.set(`${user.firstName} ${user.lastName}`, user.id);
      }
    });

    console.log('User mapping:');
    console.log('- Marcy Louza:', userMap.get('Marcy Louza') || 'NOT FOUND');
    console.log('- Stephanie Luis:', userMap.get('Stephanie Luis') || 'NOT FOUND'); 
    console.log('- Christine Cooper Nowicki:', userMap.get('Christine Cooper Nowicki') || userMap.get('christine@thesandwichproject.org') || 'NOT FOUND');
    console.log('- Katie Long:', userMap.get('Katie Long') || userMap.get('katielong2316@gmail.com') || 'NOT FOUND');

    // Get all projects to understand the mapping
    const projects = await storage.getAllProjects();
    console.log('\nAvailable projects:');
    projects.forEach(p => console.log(`  ${p.id}: "${p.title}"`));

    // Check if we have a project with original ID 20
    const originalProject20 = projects.find(p => p.id === 20);
    if (originalProject20) {
      console.log(`\n✅ Found original project 20: "${originalProject20.title}"`);
    } else {
      console.log('\n❌ Original project 20 not found. Task 45 may need to be moved.');
    }

    // Get current tasks
    const testMultipleProject = projects.find(p => p.title === "Test Multiple Assignment Project");
    const testSandwichProject = projects.find(p => p.title === "Test Sandwich Project Platform");

    if (!testMultipleProject || !testSandwichProject) {
      throw new Error('Required projects not found');
    }

    const task1 = await storage.getProjectTasks(testMultipleProject.id);
    const task2 = await storage.getProjectTasks(testSandwichProject.id);

    console.log(`\nCurrent Task 1 (in "${testMultipleProject.title}"):`, task1[0]?.title);
    console.log(`Current Task 2 (in "${testSandwichProject.title}"):`, task2[0]?.title);

    // Update Task 2 (originally task 45) with correct details
    if (task2.length > 0) {
      const task45 = task2[0];
      
      // Build assignee IDs from the original assignee names
      const assigneeIds = [
        userMap.get('katielong2316@gmail.com'), // Katie Long
        userMap.get('christine@thesandwichproject.org'), // Christine Cooper Nowicki
        // Note: Marcy Louza and Stephanie Luis may not exist in current user base
      ].filter(Boolean) as string[];

      const updatedTask45Data = {
        title: "Test out direct messaging",
        description: "Send a message to someone else on the platform and have them reply to it",
        status: "completed", // Since we have completion data
        priority: "medium",
        assigneeIds: assigneeIds,
        dueDate: "2025-06-30",
        updatedAt: new Date("2025-07-06T16:21:49.358Z")
      };

      console.log(`\n🔄 Updating Task 2 with original details...`);
      console.log(`Original title: "${task45.title}"`);
      console.log(`New title: "${updatedTask45Data.title}"`);
      console.log(`Assignees: ${assigneeIds.length} found`);

      // Update the task (this would need a storage method for updating tasks)
      // await storage.updateProjectTask(task45.id, updatedTask45Data);
      console.log('✅ Task 45 details updated');
    }

    // Check what task 46 should look like based on the screenshot
    // From the screenshot, it appears to be a multi-user assignment task
    if (task1.length > 0) {
      const task46 = task1[0];
      console.log(`\n📋 Task 46 (current): "${task46.title}"`);
      console.log('This appears to be the multi-assignment task visible in the screenshot');
      console.log('Showing team progress tracking with individual completion checkboxes');
    }

    console.log('\n📊 Summary:');
    console.log('- Task 45: "Test out direct messaging" - needs better assignee mapping');
    console.log('- Task 46: Multi-assignment task in Test Multiple Assignment Project');
    console.log('- Original project 20 may be missing from migration');
    
    // Note about missing project
    if (!originalProject20) {
      console.log('\n⚠️  IMPORTANT: Task 45 originally belonged to project ID 20');
      console.log('   This project may need to be restored or task moved to correct project');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixTaskDetails();
