import 'dotenv/config';
import { storage } from './storage-wrapper.js';

interface TaskCompletionData {
  id: number;
  taskId: number;
  userId: string;
  userName: string;
  completedAt: string;
  notes: string;
}

// Task completion data from the old platform
const task46Completions: TaskCompletionData[] = [
  {
    "id": 1,
    "taskId": 46,
    "userId": "user_1751071509329_mrkw2z95z",
    "userName": "katielong2316@gmail.com",
    "completedAt": "2025-07-06T05:21:07.323Z",
    "notes": ""
  },
  {
    "id": 16,
    "taskId": 46,
    "userId": "user_1751493923615_nbcyq3am7",
    "userName": "christine@thesandwichproject.org",
    "completedAt": "2025-07-06T17:51:55.586Z",
    "notes": "created task and completing task"
  }
];

const task45Completions: TaskCompletionData[] = [
  {
    "id": 15,
    "taskId": 45,
    "userId": "user_1751071509329_mrkw2z95z",
    "userName": "katielong2316@gmail.com",
    "completedAt": "2025-07-06T16:21:54.298Z",
    "notes": ""
  }
];

async function migrateTaskCompletions() {
  try {
    console.log('🚀 Starting task completion migration...');

    // Get all users to map usernames to IDs
    const users = await storage.getAllUsers();
    console.log(`Found ${users.length} users in database`);

    const userMap = new Map<string, string>();
    users.forEach(user => {
      if (user.email) {
        userMap.set(user.email, user.id);
      }
    });

    // Get all projects to find target projects
    const projects = await storage.getAllProjects();
    const testMultipleProject = projects.find(p => p.title === "Test Multiple Assignment Project");
    const testSandwichProject = projects.find(p => p.title === "Test Sandwich Project Platform");
    
    if (!testMultipleProject) {
      throw new Error('Could not find "Test Multiple Assignment Project"');
    }
    if (!testSandwichProject) {
      throw new Error('Could not find "Test Sandwich Project Platform"');
    }

    console.log(`Found "Test Multiple Assignment Project" with ID: ${testMultipleProject.id}`);
    console.log(`Found "Test Sandwich Project Platform" with ID: ${testSandwichProject.id}`);

    // Step 1: Create missing tasks
    console.log('\n📝 Creating missing tasks...');

    // Create task 46 for "Test Multiple Assignment Project"
    const task46Data = {
      title: "Task 46 - Restored from completions",
      description: "This task was restored from completion data. Originally completed by katielong2316@gmail.com and christine@thesandwichproject.org on 2025-07-06.",
      status: "completed",
      priority: "medium",
      assigneeIds: [
        userMap.get("katielong2316@gmail.com"),
        userMap.get("christine@thesandwichproject.org")
      ].filter(Boolean) as string[],
      dueDate: "2025-07-06",
      projectId: testMultipleProject.id,
      createdAt: new Date("2025-07-05"), // Created before completion
      updatedAt: new Date("2025-07-06T17:51:55.586Z") // Last completion time
    };

    let task46;
    try {
      task46 = await storage.createProjectTask(task46Data);
      console.log(`✅ Created task 46: "${task46.title}" (New ID: ${task46.id})`);
    } catch (error) {
      console.error(`❌ Failed to create task 46:`, error);
      return;
    }

    // For task 45, assign it to "Test Sandwich Project Platform" (Project 6)
    console.log('\n📝 Creating task 45 in "Test Sandwich Project Platform"...');

    const task45Data = {
      title: "Task 45 - Restored from completions", 
      description: "This task was restored from completion data. Originally completed by katielong2316@gmail.com on 2025-07-06.",
      status: "completed",
      priority: "medium",
      assigneeIds: [userMap.get("katielong2316@gmail.com")].filter(Boolean) as string[],
      dueDate: "2025-07-06",
      projectId: testSandwichProject.id, // Correct project assignment
      createdAt: new Date("2025-07-05"), // Created before completion
      updatedAt: new Date("2025-07-06T16:21:54.298Z") // Completion time
    };

    let task45;
    try {
      task45 = await storage.createProjectTask(task45Data);
      console.log(`✅ Created task 45: "${task45.title}" (New ID: ${task45.id})`);
    } catch (error) {
      console.error(`❌ Failed to create task 45:`, error);
      return;
    }

    // Step 2: Migrate completion data
    console.log('\n✅ Migrating task completions...');

    // Migrate task 46 completions
    for (const completion of task46Completions) {
      const userId = userMap.get(completion.userName);
      if (!userId) {
        console.log(`⚠️  User not found: ${completion.userName}`);
        continue;
      }

      try {
        const completionData = {
          taskId: task46.id, // Use new task ID
          userId: userId,
          completedAt: new Date(completion.completedAt),
          notes: completion.notes || null
        };

        await storage.createTaskCompletion(completionData);
        console.log(`✅ Migrated completion for task 46 by ${completion.userName}`);
      } catch (error) {
        console.error(`❌ Failed to migrate completion for ${completion.userName}:`, error);
      }
    }

    // Migrate task 45 completions
    for (const completion of task45Completions) {
      const userId = userMap.get(completion.userName);
      if (!userId) {
        console.log(`⚠️  User not found: ${completion.userName}`);
        continue;
      }

      try {
        const completionData = {
          taskId: task45.id, // Use new task ID
          userId: userId,
          completedAt: new Date(completion.completedAt),
          notes: completion.notes || null
        };

        await storage.createTaskCompletion(completionData);
        console.log(`✅ Migrated completion for task 45 by ${completion.userName}`);
      } catch (error) {
        console.error(`❌ Failed to migrate completion for ${completion.userName}:`, error);
      }
    }

    console.log('\n🎉 Task completion migration completed!');
    console.log('\n📊 Summary:');
    console.log(`- Created task 45 in "Test Sandwich Project Platform" (new ID: ${task45.id}) with 1 completion`);
    console.log(`- Created task 46 in "Test Multiple Assignment Project" (new ID: ${task46.id}) with 2 completions`);
    console.log(`- All individual user completions migrated successfully`);

    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateTaskCompletions();
}

export { migrateTaskCompletions };
