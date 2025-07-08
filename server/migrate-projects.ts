import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { storage } from './storage-wrapper.js';

interface MigrationStats {
  total: number;
  successful: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface BackupProject {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  assigneeId: string | null;
  assigneeName: string;
  assigneeIds: string[];
  assigneeNames: string;
  dueDate: string;
  startDate: string | null;
  completionDate: string | null;
  progressPercentage: number;
  notes: string | null;
  requirements: string | null;
  deliverables: string | null;
  resources: string | null;
  blockers: string | null;
  tags: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  budget: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export async function migrateProjects(filePath: string = './backup_files/projects.json', overwrite: boolean = false): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    successful: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  try {
    console.log(`📋 Starting projects migration from ${filePath}`);
    
    // Read and parse the projects.json file
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const backupProjects: BackupProject[] = JSON.parse(jsonData);
    
    stats.total = backupProjects.length;
    console.log(`📊 Found ${stats.total} projects to migrate`);

    for (const project of backupProjects) {
      try {
        // Check if project already exists by title
        const existingProjects = await storage.getAllProjects();
        const existingProject = existingProjects.find(p => p.title.toLowerCase() === project.title.toLowerCase());

        if (existingProject && !overwrite) {
          console.log(`⏭️  Skipping existing project: ${project.title}`);
          stats.skipped++;
          continue;
        }

        const projectData = {
          title: project.title,
          description: project.description,
          status: project.status,
          priority: project.priority || 'medium',
          category: project.category || 'general',
          assigneeId: project.assigneeId ? parseInt(project.assigneeId) : null,
          assigneeName: project.assigneeName,
          assigneeIds: project.assigneeIds || [],
          assigneeNames: project.assigneeNames,
          dueDate: project.dueDate,
          startDate: project.startDate,
          completionDate: project.completionDate,
          progressPercentage: project.progressPercentage || 0,
          notes: project.notes,
          requirements: project.requirements,
          deliverables: project.deliverables,
          resources: project.resources,
          blockers: project.blockers,
          tags: project.tags,
          estimatedHours: project.estimatedHours,
          actualHours: project.actualHours,
          budget: project.budget,
          color: project.color || 'blue',
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt)
        };

        if (existingProject && overwrite) {
          // Update existing project
          const updatedProject = await storage.updateProject(existingProject.id, projectData);
          console.log(`✅ Updated project: ${project.title} (ID: ${updatedProject?.id})`);
        } else {
          // Create new project
          const createdProject = await storage.createProject(projectData);
          console.log(`✅ Created project: ${project.title} (ID: ${createdProject.id})`);
        }

        stats.successful++;

      } catch (error) {
        const errorMsg = `Failed to migrate project ${project.title}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }

    // Print summary
    console.log('\\n📊 Projects Migration Summary:');
    console.log(`Total projects: ${stats.total}`);
    console.log(`✅ Successful: ${stats.successful}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);
    
    if (stats.errors.length > 0) {
      console.log('\\n🚨 Errors:');
      stats.errors.forEach(error => console.log(`  - ${error}`));
    }

    return stats;

  } catch (error) {
    console.error('❌ Projects migration failed:', error);
    throw error;
  }
}

// Preview function
export async function previewProjects(filePath: string = './backup_files/projects.json'): Promise<void> {
  try {
    const jsonData = fs.readFileSync(filePath, 'utf8');
    const backupProjects: BackupProject[] = JSON.parse(jsonData);
    
    console.log(`📋 Projects Migration Preview (${backupProjects.length} records):\\n`);
    
    // Calculate stats
    const statusCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {};

    for (const project of backupProjects) {
      statusCounts[project.status] = (statusCounts[project.status] || 0) + 1;
      categoryCounts[project.category] = (categoryCounts[project.category] || 0) + 1;
      priorityCounts[project.priority] = (priorityCounts[project.priority] || 0) + 1;
    }

    console.log(`📊 Projects by status:`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    console.log(`\\n📂 Projects by category:`);
    Object.entries(categoryCounts).forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });

    console.log(`\\n⚡ Projects by priority:`);
    Object.entries(priorityCounts).forEach(([priority, count]) => {
      console.log(`  ${priority}: ${count}`);
    });

    // Check for existing projects
    const existingProjects = await storage.getAllProjects();
    const existingTitles = existingProjects.map(p => p.title.toLowerCase());
    
    const newProjects: string[] = [];
    const duplicateProjects: string[] = [];

    for (const project of backupProjects) {
      if (existingTitles.includes(project.title.toLowerCase())) {
        duplicateProjects.push(project.title);
      } else {
        newProjects.push(project.title);
      }
    }

    console.log(`\\n🆕 New projects to be created: ${newProjects.length}`);
    if (newProjects.length > 0) {
      newProjects.slice(0, 5).forEach(title => console.log(`  - ${title}`));
      if (newProjects.length > 5) {
        console.log(`  ... and ${newProjects.length - 5} more`);
      }
    }

    console.log(`\\n⚠️  Existing projects that would be skipped: ${duplicateProjects.length}`);
    if (duplicateProjects.length > 0) {
      duplicateProjects.slice(0, 5).forEach(title => console.log(`  - ${title}`));
      if (duplicateProjects.length > 5) {
        console.log(`  ... and ${duplicateProjects.length - 5} more`);
      }
    }

    // Show sample data structure
    if (backupProjects.length > 0) {
      const sample = backupProjects[0];
      console.log('\\n📋 Sample project data:');
      console.log(`  Title: ${sample.title}`);
      console.log(`  Status: ${sample.status}`);
      console.log(`  Priority: ${sample.priority}`);
      console.log(`  Category: ${sample.category}`);
      console.log(`  Progress: ${sample.progressPercentage}%`);
      console.log(`  Due Date: ${sample.dueDate || 'N/A'}`);
      console.log(`  Assignee: ${sample.assigneeName || 'Unassigned'}`);
    }

    console.log('\\n💡 To run the migration:');
    console.log('  npm run migrate-projects');
    console.log('  npm run migrate-projects -- --overwrite  (to update existing projects)');

  } catch (error) {
    console.error('❌ Preview failed:', error);
  }
}

// CLI handler
export async function runProjectsMigration() {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite') || args.includes('-o');
  const preview = args.includes('--preview') || args.includes('-p');
  const filePath = args.find(arg => arg.endsWith('.json')) || './backup_files/projects.json';

  console.log('🚀 Starting projects migration...');
  console.log(`📁 Source file: ${filePath}`);
  console.log(`🔄 Overwrite existing: ${overwrite}`);
  console.log('');

  try {
    if (preview) {
      await previewProjects(filePath);
    } else {
      const stats = await migrateProjects(filePath, overwrite);
      
      if (stats.failed === 0) {
        console.log('\\n🎉 Projects migration completed successfully!');
      } else {
        console.log('\\n⚠️  Projects migration completed with some errors.');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('\\n💥 Projects migration failed completely:', error);
    process.exit(1);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite') || args.includes('-o');
  const preview = args.includes('--preview') || args.includes('-p');

  console.log('🚀 Starting projects migration...');
  console.log('');

  if (preview) {
    previewProjects().then(() => {
      console.log('\n✅ Preview completed!');
      process.exit(0);
    }).catch(error => {
      console.error('\n💥 Preview failed:', error);
      process.exit(1);
    });
  } else {
    migrateProjects('./backup_files/projects.json', overwrite).then(() => {
      console.log('\n✅ Migration completed!');
      process.exit(0);
    }).catch(error => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    });
  }
}
