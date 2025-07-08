import 'dotenv/config';
import { storage } from './storage-wrapper.js';

async function restoreDirectMessagingProject() {
  try {
    console.log('🔧 Restoring missing "Test out direct messaging" project...');

    // Get all users for assignee mapping
    const users = await storage.getAllUsers();
    const userMap = new Map<string, string>();
    users.forEach(user => {
      if (user.email) {
        userMap.set(user.email, user.id);
      }
    });

    console.log('Available users for assignment:');
    console.log('- katielong2316@gmail.com:', userMap.get('katielong2316@gmail.com') || 'NOT FOUND');
    console.log('- christine@thesandwichproject.org:', userMap.get('christine@thesandwichproject.org') || 'NOT FOUND');

    // Step 1: Create the missing "Test out direct messaging" project
    console.log('\n📋 Creating missing project: "Test out direct messaging"...');
    
    const directMessagingProjectData = {
      title: "Test out direct messaging",
      description: "Project focused on testing and implementing direct messaging functionality on the platform",
      status: "in_progress",
      priority: "medium",
      category: "communication",
      assigneeId: userMap.get('katielong2316@gmail.com') || null,
      assigneeName: "Katie Long",
      assigneeIds: [
        userMap.get('katielong2316@gmail.com'),
        userMap.get('christine@thesandwichproject.org')
      ].filter(Boolean) as string[],
      assigneeNames: "Katie Long, Christine Cooper Nowicki",
      dueDate: "2025-06-30",
      startDate: "2025-06-30",
      progressPercentage: 75, // Since task was mostly completed
      color: "blue",
      createdAt: new Date("2025-06-30T22:00:00.000Z"), // Before task creation
      updatedAt: new Date("2025-07-06T16:21:49.358Z") // Last task update
    };

    const newProject = await storage.createProject(directMessagingProjectData);
    console.log(`✅ Created project: "${newProject.title}" (ID: ${newProject.id})`);

    // Step 2: Get the current task 45 (currently in wrong project)
    const testSandwichProject = await storage.getAllProjects().then(projects => 
      projects.find(p => p.title === "Test Sandwich Project Platform")
    );

    if (!testSandwichProject) {
      throw new Error('Could not find Test Sandwich Project Platform');
    }

    const currentTasks = await storage.getProjectTasks(testSandwichProject.id);
    const task45 = currentTasks.find(t => t.title.includes("Test out direct messaging") || t.title.includes("45"));

    if (!task45) {
      console.log('❌ Could not find task 45 to move');
      return;
    }

    console.log(`\n📦 Found task to move: "${task45.title}" (ID: ${task45.id})`);

    // Step 3: Create the corrected task in the new project
    console.log('\n📝 Creating corrected task in new project...');
    
    const assigneeIds = [
      userMap.get('katielong2316@gmail.com'),
      userMap.get('christine@thesandwichproject.org'),
      // Note: Marcy Louza and Stephanie Luis might need to be added if they exist
    ].filter(Boolean) as string[];

    const correctedTaskData = {
      title: "Test out direct messaging",
      description: "Send a message to someone else on the platform and have them reply to it",
      status: "completed", // Since we have completion data
      priority: "medium",
      assigneeIds: assigneeIds,
      dueDate: "2025-06-30",
      projectId: newProject.id,
      createdAt: new Date("2025-06-30T22:02:18.138Z"), // Original creation time
      updatedAt: new Date("2025-07-06T16:21:49.358Z") // Original update time
    };

    const correctedTask = await storage.createProjectTask(correctedTaskData);
    console.log(`✅ Created corrected task: "${correctedTask.title}" (ID: ${correctedTask.id})`);

    // Step 4: Migrate completion data to new task
    console.log('\n✅ Migrating completion data to corrected task...');
    
    const completionData = {
      taskId: correctedTask.id,
      userId: userMap.get('katielong2316@gmail.com')!,
      completedAt: new Date("2025-07-06T16:21:54.298Z"),
      notes: null
    };

    await storage.createTaskCompletion(completionData);
    console.log('✅ Migrated Katie Long completion');

    // Step 5: Delete the incorrectly placed task
    console.log('\n🗑️  Removing incorrectly placed task...');
    try {
      // Note: This would need a deleteProjectTask method in storage
      // await storage.deleteProjectTask(task45.id);
      console.log('⚠️  Manual cleanup needed: Remove old task from Test Sandwich Project Platform');
    } catch (error) {
      console.log('⚠️  Could not auto-delete old task:', error);
    }

    console.log('\n🎉 Direct messaging project restoration completed!');
    console.log('\n📊 Summary:');
    console.log(`✅ Created project: "Test out direct messaging" (ID: ${newProject.id})`);
    console.log(`✅ Created corrected task: "Test out direct messaging" (ID: ${correctedTask.id})`);
    console.log(`✅ Migrated completion data for Katie Long`);
    console.log(`⚠️  Note: Original task in wrong project may need manual cleanup`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

restoreDirectMessagingProject();
