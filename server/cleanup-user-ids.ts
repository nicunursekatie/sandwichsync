import 'dotenv/config';
import { db } from './db.js';
import { users, taskCompletions, projectTasks } from '../shared/schema.js';
import { eq } from 'drizzle-orm';

async function cleanupUserIds() {
  try {
    console.log('🔧 Cleaning up user IDs...');

    // Get all current users
    const allUsers = await db.select().from(users);
    console.log(`\nFound ${allUsers.length} users with messy IDs:`);
    
    allUsers.forEach(user => {
      console.log(`  ${user.id} -> ${user.firstName} ${user.lastName} (${user.email})`);
    });

    // Create mapping of old IDs to new clean IDs
    const userMappings = new Map<string, string>();
    
    for (const user of allUsers) {
      let newId: string;
      
      // Create clean IDs based on email or name
      if (user.email === 'admin@sandwich.project') {
        newId = 'admin';
      } else if (user.email === 'katielong2316@gmail.com') {
        newId = 'katie_long';
      } else if (user.email === 'kenig.ka@gmail.com') {
        newId = 'katie_driver'; // Second Katie account
      } else if (user.email === 'christine@thesandwichproject.org') {
        newId = 'christine_cooper';
      } else if (user.email === 'stephanie@thesandwichproject.org') {
        newId = 'stephanie_luis';
      } else if (user.email === 'mdlouza@gmail.com') {
        newId = 'marcy_louza';
      } else if (user.email === 'vickib@aol.com') {
        newId = 'vicki_tropauer';
      } else {
        // Fallback: use first name + last name
        const firstName = user.firstName?.toLowerCase().replace(/[^a-z]/g, '') || 'user';
        const lastName = user.lastName?.toLowerCase().replace(/[^a-z]/g, '') || 'unknown';
        newId = `${firstName}_${lastName}`;
      }
      
      userMappings.set(user.id, newId);
      console.log(`  ${user.id} -> ${newId}`);
    }

    console.log('\n🔄 Updating user IDs...');

    // Update each user with new clean ID
    const userEntries = Array.from(userMappings.entries());
    for (const [oldId, newId] of userEntries) {
      try {
        // Update the user record
        await db
          .update(users)
          .set({ id: newId })
          .where(eq(users.id, oldId));
        
        console.log(`✅ Updated user: ${oldId} -> ${newId}`);
      } catch (error) {
        console.log(`❌ Error updating user ${oldId}: ${error}`);
      }
    }

    console.log('\n🔄 Updating task completions...');

    // Update task completions to use new user IDs
    for (const [oldId, newId] of userEntries) {
      try {
        await db
          .update(taskCompletions)
          .set({ userId: newId })
          .where(eq(taskCompletions.userId, oldId));
        
        console.log(`✅ Updated task completions for: ${oldId} -> ${newId}`);
      } catch (error) {
        console.log(`❌ Error updating task completions for ${oldId}: ${error}`);
      }
    }

    console.log('\n🔄 Updating project task assignments...');

    // Update project tasks assignee IDs
    const allTasks = await db.select().from(projectTasks);
    
    for (const task of allTasks) {
      if (task.assigneeIds && task.assigneeIds.length > 0) {
        const updatedAssigneeIds = task.assigneeIds.map(oldId => 
          userMappings.get(oldId) || oldId
        );
        
        // Also update assigneeId if it exists
        const updatedAssigneeId = task.assigneeId ? 
          (userMappings.get(task.assigneeId) || task.assigneeId) : 
          task.assigneeId;

        try {
          await db
            .update(projectTasks)
            .set({ 
              assigneeIds: updatedAssigneeIds,
              assigneeId: updatedAssigneeId
            })
            .where(eq(projectTasks.id, task.id));
          
          console.log(`✅ Updated task ${task.id} assignees`);
        } catch (error) {
          console.log(`❌ Error updating task ${task.id}: ${error}`);
        }
      }
    }

    console.log('\n🎉 User ID cleanup completed!');
    console.log('\n📊 New clean user IDs:');
    
    const updatedUsers = await db.select().from(users);
    updatedUsers.forEach(user => {
      console.log(`  ✅ ${user.id} - ${user.firstName} ${user.lastName} (${user.email})`);
    });

    console.log('\n🔄 Please refresh the frontend to see the clean user IDs!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupUserIds();
