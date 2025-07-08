import 'dotenv/config';
import { storage } from './storage-wrapper.js';

async function checkTasks() {
  try {
    console.log('=== CHECKING EXISTING TASKS ===');
    
    const projects = await storage.getAllProjects();
    console.log(`Found ${projects.length} projects`);
    
    let allTasks: any[] = [];
    
    for (const project of projects) {
      console.log(`\nProject: "${project.title}" (ID: ${project.id})`);
      try {
        // Get tasks for this project
        const tasks = await storage.getProjectTasks(project.id);
        if (tasks && tasks.length > 0) {
          console.log(`  Found ${tasks.length} tasks:`);
          tasks.forEach(task => {
            console.log(`    Task ID: ${task.id} - "${task.title}"`);
            allTasks.push({ ...task, projectTitle: project.title });
          });
        } else {
          console.log(`  No tasks found`);
        }
      } catch (error) {
        console.log(`  Error getting tasks: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log('\n=== TASK COMPLETION DATA TO MIGRATE ===');
    console.log('Task ID 46 completions:');
    console.log('- katielong2316@gmail.com completed on 2025-07-06T05:21:07.323Z');
    console.log('- christine@thesandwichproject.org completed on 2025-07-06T17:51:55.586Z with note: "created task and completing task"');
    
    console.log('\nTask ID 45 completions:');
    console.log('- katielong2316@gmail.com completed on 2025-07-06T16:21:54.298Z');
    
    // Check if these task IDs exist
    const task45 = allTasks.find(t => t.id === 45);
    const task46 = allTasks.find(t => t.id === 46);
    
    console.log('\n=== TASK ID MATCHING ===');
    if (task45) {
      console.log(`✅ Task ID 45 found: "${task45.title}" in project "${task45.projectTitle}"`);
    } else {
      console.log(`❌ Task ID 45 not found in current database`);
    }
    
    if (task46) {
      console.log(`✅ Task ID 46 found: "${task46.title}" in project "${task46.projectTitle}"`);
    } else {
      console.log(`❌ Task ID 46 not found in current database`);
    }
    
    console.log(`\n📊 Total tasks in database: ${allTasks.length}`);
    if (allTasks.length > 0) {
      console.log(`Task ID range: ${Math.min(...allTasks.map(t => t.id))} - ${Math.max(...allTasks.map(t => t.id))}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTasks();
