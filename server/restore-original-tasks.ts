import 'dotenv/config';
import { storage } from './storage-wrapper.js';

interface OriginalTaskData {
  id: number;
  projectId: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  assigneeName: string;
  assigneeIds: string[];
  assigneeNames: string[];
  dueDate: string;
  completedAt: string | null;
  attachments: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface TaskCompletionData {
  id: number;
  taskId: number;
  userId: string;
  userName: string;
  completedAt: string;
  notes: string;
}

// Original task data from your old platform
const originalTask45: OriginalTaskData = {
  "id": 45,
  "projectId": 20, // Original project ID
  "title": "Test out direct messaging",
  "description": "Send a message to someone else on the platform and have them reply to it",
  "status": "waiting",
  "priority": "medium",
  "assigneeId": null,
  "assigneeName": "",
  "assigneeIds": ["user_1751072243271_fc8jaxl6u", "user_1751492211973_0pi1jdl3p", "user_1751493923615_nbcyq3am7", "user_1751071509329_mrkw2z95z"],
  "assigneeNames": ["Marcy Louza", "Stephanie Luis", "Christine Cooper Nowicki", "Katie Long"],
  "dueDate": "2025-06-30T00:00:00.000+00:00",
  "completedAt": null,
  "attachments": null,
  "order": 0,
  "createdAt": "2025-06-30T22:02:18.138Z",
  "updatedAt": "2025-07-06T16:21:49.358Z"
};

// Task 46 data (we need to reconstruct this based on completion data)
// From the completion note: "created task and completing task" by christine@thesandwichproject.org
const originalTask46 = {
  id: 46,
  title: "Task created and completed by Christine", // Inferred from completion note
  description: "This task was created and completed as part of testing the platform functionality",
  status: "completed", // Both users completed it
  priority: "medium",
  assigneeIds: ["user_1751071509329_mrkw2z95z", "user_1751493923615_nbcyq3am7"], // From completion data
  assigneeNames: ["Katie Long", "Christine Cooper Nowicki"], // From completion data
  dueDate: "2025-07-06",
  createdAt: "2025-07-05T00:00:00.000Z", // Before first completion
  updatedAt: "2025-07-06T17:51:55.586Z" // Last completion time
};

// Task completion data
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

async function restoreOriginalTasks() {
  try {
    console.log('🔄 Starting restoration of original tasks with accurate data...');

    // Get all users to map old user IDs and emails to new user IDs
    const users = await storage.getAllUsers();
    console.log(`Found ${users.length} users in database`);

    // Create mapping from old user IDs to new user IDs
    const oldUserIdMap = new Map<string, string>();
    const emailToUserIdMap = new Map<string, string>();
    
    users.forEach(user => {
      if (user.email) {
        emailToUserIdMap.set(user.email, user.id);
        
        // Map known old user IDs based on completion data
        if (user.email === "katielong2316@gmail.com") {
          oldUserIdMap.set("user_1751071509329_mrkw2z95z", user.id);
        }
        if (user.email === "christine@thesandwichproject.org") {
          oldUserIdMap.set("user_1751493923615_nbcyq3am7", user.id);
        }
        // Add other mappings as needed
        if (user.firstName === "Marcy" && user.lastName === "Louza") {
          oldUserIdMap.set("user_1751072243271_fc8jaxl6u", user.id);
        }
        if (user.firstName === "Stephanie" && user.lastName === "Luis") {
          oldUserIdMap.set("user_1751492211973_0pi1jdl3p", user.id);
        }
      }
    });

    // Get projects to find the correct target projects
    const projects = await storage.getAllProjects();
    const testMultipleProject = projects.find(p => p.title === "Test Multiple Assignment Project");
    const testSandwichProject = projects.find(p => p.title === "Test Sandwich Project Platform");
    
    if (!testMultipleProject) {
      throw new Error('Could not find "Test Multiple Assignment Project"');
    }
    if (!testSandwichProject) {
      throw new Error('Could not find "Test Sandwich Project Platform"');
    }

    console.log(`Target projects found:`);
    console.log(`- "Test Multiple Assignment Project" (ID: ${testMultipleProject.id})`);
    console.log(`- "Test Sandwich Project Platform" (ID: ${testSandwichProject.id})`);

    // Step 1: Delete existing incorrect tasks if they exist
    console.log('\n🗑️  Cleaning up previously created placeholder tasks...');
    try {
      const existingTasks = await storage.getProjectTasks(testMultipleProject.id);
      for (const task of existingTasks) {
        if (task.title.includes("Restored from completions")) {
          await storage.deleteProjectTask(task.id);
          console.log(`🗑️  Deleted placeholder task: ${task.title}`);
        }
      }
      
      const existingTasks2 = await storage.getProjectTasks(testSandwichProject.id);
      for (const task of existingTasks2) {
        if (task.title.includes("Restored from completions")) {
          await storage.deleteProjectTask(task.id);
          console.log(`🗑️  Deleted placeholder task: ${task.title}`);
        }
      }
    } catch (error) {
      console.log(`⚠️  No existing tasks to clean up or error during cleanup: ${error}`);
    }

    // Step 2: Create Task 45 with original data in "Test Sandwich Project Platform"
    console.log('\n📝 Creating Task 45 with original data...');
    
    // Map assignee IDs from old system to new system
    const task45NewAssigneeIds = originalTask45.assigneeIds
      .map(oldId => oldUserIdMap.get(oldId))
      .filter(Boolean) as string[];
    
    const task45Data = {
      projectId: testSandwichProject.id, // Map to current project 6
      title: originalTask45.title,
      description: originalTask45.description,
      status: "completed", // Mark as completed since someone completed it
      priority: originalTask45.priority,
      assigneeIds: task45NewAssigneeIds,
      assigneeNames: originalTask45.assigneeNames,
      dueDate: originalTask45.dueDate,
      order: originalTask45.order,
      createdAt: new Date(originalTask45.createdAt),
      updatedAt: new Date(originalTask45.updatedAt)
    };

    let restoredTask45;
    try {
      restoredTask45 = await storage.createProjectTask(task45Data);
      console.log(`✅ Restored Task 45: "${restoredTask45.title}" (New ID: ${restoredTask45.id})`);
      console.log(`   Assigned to: ${originalTask45.assigneeNames.join(', ')}`);
    } catch (error) {
      console.error(`❌ Failed to restore task 45:`, error);
      return;
    }

    // Step 3: Create Task 46 with reconstructed data in "Test Multiple Assignment Project"
    console.log('\n📝 Creating Task 46 with reconstructed data...');
    
    const task46NewAssigneeIds = [
      emailToUserIdMap.get("katielong2316@gmail.com"),
      emailToUserIdMap.get("christine@thesandwichproject.org")
    ].filter(Boolean) as string[];

    const task46Data = {
      projectId: testMultipleProject.id, // Map to current project 1
      title: originalTask46.title,
      description: originalTask46.description,
      status: originalTask46.status,
      priority: originalTask46.priority,
      assigneeIds: task46NewAssigneeIds,
      assigneeNames: originalTask46.assigneeNames,
      dueDate: originalTask46.dueDate,
      createdAt: new Date(originalTask46.createdAt),
      updatedAt: new Date(originalTask46.updatedAt)
    };

    let restoredTask46;
    try {
      restoredTask46 = await storage.createProjectTask(task46Data);
      console.log(`✅ Restored Task 46: "${restoredTask46.title}" (New ID: ${restoredTask46.id})`);
      console.log(`   Assigned to: ${originalTask46.assigneeNames.join(', ')}`);
    } catch (error) {
      console.error(`❌ Failed to restore task 46:`, error);
      return;
    }

    // Step 4: Migrate completion data
    console.log('\n✅ Migrating task completions...');

    // Migrate task 45 completions
    for (const completion of task45Completions) {
      const userId = emailToUserIdMap.get(completion.userName);
      if (!userId) {
        console.log(`⚠️  User not found for completion: ${completion.userName}`);
        continue;
      }

      try {
        const completionData = {
          taskId: restoredTask45.id,
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

    // Migrate task 46 completions
    for (const completion of task46Completions) {
      const userId = emailToUserIdMap.get(completion.userName);
      if (!userId) {
        console.log(`⚠️  User not found for completion: ${completion.userName}`);
        continue;
      }

      try {
        const completionData = {
          taskId: restoredTask46.id,
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

    console.log('\n🎉 Task restoration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`✅ Task 45: "${originalTask45.title}"`);
    console.log(`   - Project: "Test Sandwich Project Platform" (ID: ${testSandwichProject.id})`);
    console.log(`   - New Task ID: ${restoredTask45.id}`);
    console.log(`   - Assignees: ${originalTask45.assigneeNames.join(', ')}`);
    console.log(`   - Completions: ${task45Completions.length}`);
    
    console.log(`✅ Task 46: "${originalTask46.title}"`);
    console.log(`   - Project: "Test Multiple Assignment Project" (ID: ${testMultipleProject.id})`);
    console.log(`   - New Task ID: ${restoredTask46.id}`);
    console.log(`   - Assignees: ${originalTask46.assigneeNames.join(', ')}`);
    console.log(`   - Completions: ${task46Completions.length}`);

    process.exit(0);
  } catch (error) {
    console.error('💥 Task restoration failed:', error);
    process.exit(1);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  restoreOriginalTasks();
}

export { restoreOriginalTasks };
