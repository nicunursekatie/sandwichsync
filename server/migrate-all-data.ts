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

interface BackupHost {
  id: number;
  name: string;
  address: string;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface BackupRecipient {
  id: number;
  name: string;
  contactName: string | null;
  phone: string;
  email: string;
  address: string;
  preferences: string;
  weeklyEstimate: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
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

interface BackupConversation {
  id: number;
  type: string;
  name: string | null;
  createdAt: string;
}

interface BackupSandwichCollection {
  id: number;
  collectionDate: string;
  hostName: string;
  individualSandwiches: number;
  groupCollections: string;
  submittedAt: string;
}

interface BackupData {
  hosts: BackupHost[];
  recipients: BackupRecipient[];
  projects: BackupProject[];
  conversations: BackupConversation[];
  sandwichCollections: BackupSandwichCollection[];
  messages: any[]; // Empty in backup
  contacts: any[]; // Empty in backup
}

export class DataMigrator {
  private backupDir: string;
  private stats: Record<string, MigrationStats> = {};

  constructor(backupDir: string = './backup_files') {
    this.backupDir = backupDir;
  }

  private initStats(dataType: string): MigrationStats {
    return {
      total: 0,
      successful: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };
  }

  private async loadBackupData(): Promise<BackupData> {
    const data: BackupData = {
      hosts: [],
      recipients: [],
      projects: [],
      conversations: [],
      sandwichCollections: [],
      messages: [],
      contacts: []
    };

    try {
      // Load hosts
      const hostsPath = path.join(this.backupDir, 'hosts.json');
      if (fs.existsSync(hostsPath)) {
        data.hosts = JSON.parse(fs.readFileSync(hostsPath, 'utf8'));
      }

      // Load recipients
      const recipientsPath = path.join(this.backupDir, 'recipients.json');
      if (fs.existsSync(recipientsPath)) {
        data.recipients = JSON.parse(fs.readFileSync(recipientsPath, 'utf8'));
      }

      // Load projects
      const projectsPath = path.join(this.backupDir, 'projects.json');
      if (fs.existsSync(projectsPath)) {
        data.projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
      }

      // Load conversations
      const conversationsPath = path.join(this.backupDir, 'conversations.json');
      if (fs.existsSync(conversationsPath)) {
        data.conversations = JSON.parse(fs.readFileSync(conversationsPath, 'utf8'));
      }

      // Load sandwich collections
      const collectionsPath = path.join(this.backupDir, 'sandwich-collections.json');
      if (fs.existsSync(collectionsPath)) {
        const collectionsData = JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));
        data.sandwichCollections = collectionsData.collections || [];
      }

      // Load messages (if any)
      const messagesPath = path.join(this.backupDir, 'messages.json');
      if (fs.existsSync(messagesPath)) {
        data.messages = JSON.parse(fs.readFileSync(messagesPath, 'utf8'));
      }

      // Load contacts (if any)
      const contactsPath = path.join(this.backupDir, 'contacts.json');
      if (fs.existsSync(contactsPath)) {
        data.contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
      }

    } catch (error) {
      console.error('❌ Error loading backup data:', error);
      throw error;
    }

    return data;
  }

  private async migrateHosts(hosts: BackupHost[], overwrite: boolean = false): Promise<void> {
    const stats = this.initStats('hosts');
    this.stats.hosts = stats;
    stats.total = hosts.length;

    console.log(`\\n🏠 Migrating ${stats.total} hosts...`);

    for (const host of hosts) {
      try {
        // Check if host already exists by name (since we don't have getHostById in storage)
        const existingHosts = await storage.getAllHosts();
        const existingHost = existingHosts.find(h => h.name.toLowerCase() === host.name.toLowerCase());

        if (existingHost && !overwrite) {
          console.log(`⏭️  Skipping existing host: ${host.name}`);
          stats.skipped++;
          continue;
        }

        const hostData = {
          name: host.name,
          address: host.address || '',
          status: host.status || 'active',
          notes: host.notes || '',
          createdAt: new Date(host.createdAt),
          updatedAt: new Date(host.updatedAt)
        };

        const createdHost = await storage.createHost(hostData);
        console.log(`✅ Created host: ${host.name} (ID: ${createdHost.id})`);
        stats.successful++;

      } catch (error) {
        const errorMsg = `Failed to migrate host ${host.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }
  }

  private async migrateRecipients(recipients: BackupRecipient[], overwrite: boolean = false): Promise<void> {
    const stats = this.initStats('recipients');
    this.stats.recipients = stats;
    stats.total = recipients.length;

    console.log(`\\n🎯 Migrating ${stats.total} recipients...`);

    for (const recipient of recipients) {
      try {
        // Check if recipient already exists by name
        const existingRecipients = await storage.getAllRecipients();
        const existingRecipient = existingRecipients.find(r => r.name.toLowerCase() === recipient.name.toLowerCase());

        if (existingRecipient && !overwrite) {
          console.log(`⏭️  Skipping existing recipient: ${recipient.name}`);
          stats.skipped++;
          continue;
        }

        const recipientData = {
          name: recipient.name,
          contactName: recipient.contactName,
          phone: recipient.phone,
          email: recipient.email,
          address: recipient.address,
          preferences: recipient.preferences,
          weeklyEstimate: recipient.weeklyEstimate,
          status: recipient.status || 'active',
          createdAt: new Date(recipient.createdAt),
          updatedAt: new Date(recipient.updatedAt)
        };

        const createdRecipient = await storage.createRecipient(recipientData);
        console.log(`✅ Created recipient: ${recipient.name} (ID: ${createdRecipient.id})`);
        stats.successful++;

      } catch (error) {
        const errorMsg = `Failed to migrate recipient ${recipient.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }
  }

  private async migrateProjects(projects: BackupProject[], overwrite: boolean = false): Promise<void> {
    const stats = this.initStats('projects');
    this.stats.projects = stats;
    stats.total = projects.length;

    console.log(`\\n📋 Migrating ${stats.total} projects...`);

    for (const project of projects) {
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

        const createdProject = await storage.createProject(projectData);
        console.log(`✅ Created project: ${project.title} (ID: ${createdProject.id})`);
        stats.successful++;

      } catch (error) {
        const errorMsg = `Failed to migrate project ${project.title}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }
  }

  private async migrateSandwichCollections(collections: BackupSandwichCollection[], overwrite: boolean = false): Promise<void> {
    const stats = this.initStats('sandwichCollections');
    this.stats.sandwichCollections = stats;
    stats.total = collections.length;

    console.log(`\\n🥪 Migrating ${stats.total} sandwich collections...`);

    for (const collection of collections) {
      try {
        // Check if collection already exists by date and host
        const existingCollections = await storage.getAllSandwichCollections();
        const existingCollection = existingCollections.find(c => 
          c.collectionDate === collection.collectionDate && 
          c.hostName.toLowerCase() === collection.hostName.toLowerCase()
        );

        if (existingCollection && !overwrite) {
          console.log(`⏭️  Skipping existing collection: ${collection.hostName} on ${collection.collectionDate}`);
          stats.skipped++;
          continue;
        }

        const collectionData = {
          collectionDate: collection.collectionDate,
          hostName: collection.hostName,
          individualSandwiches: collection.individualSandwiches,
          groupCollections: collection.groupCollections,
          submittedAt: new Date(collection.submittedAt)
        };

        const createdCollection = await storage.createSandwichCollection(collectionData);
        console.log(`✅ Created collection: ${collection.hostName} - ${collection.individualSandwiches} sandwiches on ${collection.collectionDate}`);
        stats.successful++;

      } catch (error) {
        const errorMsg = `Failed to migrate collection ${collection.hostName} ${collection.collectionDate}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }
  }

  private async migrateConversations(conversations: BackupConversation[], overwrite: boolean = false): Promise<void> {
    const stats = this.initStats('conversations');
    this.stats.conversations = stats;
    stats.total = conversations.length;

    console.log(`\\n💬 Migrating ${stats.total} conversations...`);

    for (const conversation of conversations) {
      try {
        // For now, we'll skip conversations since messages are empty anyway
        // and conversation migration would need participant data
        console.log(`⏭️  Skipping conversation migration (no messages to restore): ${conversation.name || `ID ${conversation.id}`}`);
        stats.skipped++;

      } catch (error) {
        const errorMsg = `Failed to migrate conversation ${conversation.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        stats.errors.push(errorMsg);
        stats.failed++;
      }
    }
  }

  public async migrateAll(overwrite: boolean = false): Promise<void> {
    console.log('🚀 Starting full data migration from backup files...');
    console.log(`📁 Source directory: ${this.backupDir}`);
    console.log(`🔄 Overwrite existing: ${overwrite}`);
    console.log('');

    try {
      // Load all backup data
      console.log('📂 Loading backup data...');
      const backupData = await this.loadBackupData();

      // Migrate in order of dependencies
      await this.migrateHosts(backupData.hosts, overwrite);
      await this.migrateRecipients(backupData.recipients, overwrite);
      await this.migrateProjects(backupData.projects, overwrite);
      await this.migrateSandwichCollections(backupData.sandwichCollections, overwrite);
      await this.migrateConversations(backupData.conversations, overwrite);

      // Print comprehensive summary
      this.printMigrationSummary();

    } catch (error) {
      console.error('\\n💥 Migration failed:', error);
      throw error;
    }
  }

  private printMigrationSummary(): void {
    console.log('\\n📊 MIGRATION SUMMARY');
    console.log('='.repeat(50));
    
    let totalRecords = 0;
    let totalSuccessful = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let allErrors: string[] = [];

    for (const [dataType, stats] of Object.entries(this.stats)) {
      console.log(`\\n${dataType.toUpperCase()}:`);
      console.log(`  Total: ${stats.total}`);
      console.log(`  ✅ Successful: ${stats.successful}`);
      console.log(`  ⏭️  Skipped: ${stats.skipped}`);
      console.log(`  ❌ Failed: ${stats.failed}`);

      totalRecords += stats.total;
      totalSuccessful += stats.successful;
      totalSkipped += stats.skipped;
      totalFailed += stats.failed;
      allErrors.push(...stats.errors);
    }

    console.log('\\n' + '='.repeat(50));
    console.log('OVERALL TOTALS:');
    console.log(`Total records: ${totalRecords}`);
    console.log(`✅ Successful: ${totalSuccessful}`);
    console.log(`⏭️  Skipped: ${totalSkipped}`);
    console.log(`❌ Failed: ${totalFailed}`);

    if (allErrors.length > 0) {
      console.log('\\n🚨 ALL ERRORS:');
      allErrors.forEach(error => console.log(`  - ${error}`));
    }

    if (totalFailed === 0) {
      console.log('\\n🎉 Migration completed successfully!');
    } else {
      console.log('\\n⚠️  Migration completed with some errors.');
    }
  }

  public async previewMigration(): Promise<void> {
    console.log('📋 MIGRATION PREVIEW');
    console.log('='.repeat(50));

    try {
      const backupData = await this.loadBackupData();

      console.log(`\\n🏠 HOSTS: ${backupData.hosts.length} records`);
      if (backupData.hosts.length > 0) {
        const hostNames = backupData.hosts.slice(0, 5).map(h => h.name);
        console.log(`  Sample: ${hostNames.join(', ')}${backupData.hosts.length > 5 ? '...' : ''}`);
      }

      console.log(`\\n🎯 RECIPIENTS: ${backupData.recipients.length} records`);
      if (backupData.recipients.length > 0) {
        const recipientNames = backupData.recipients.slice(0, 5).map(r => r.name);
        console.log(`  Sample: ${recipientNames.join(', ')}${backupData.recipients.length > 5 ? '...' : ''}`);
      }

      console.log(`\\n📋 PROJECTS: ${backupData.projects.length} records`);
      if (backupData.projects.length > 0) {
        const projectTitles = backupData.projects.slice(0, 5).map(p => p.title);
        console.log(`  Sample: ${projectTitles.join(', ')}${backupData.projects.length > 5 ? '...' : ''}`);
      }

      console.log(`\\n🥪 SANDWICH COLLECTIONS: ${backupData.sandwichCollections.length} records`);
      if (backupData.sandwichCollections.length > 0) {
        const totalSandwiches = backupData.sandwichCollections.reduce((sum, c) => sum + c.individualSandwiches, 0);
        console.log(`  Total sandwiches recorded: ${totalSandwiches.toLocaleString()}`);
      }

      console.log(`\\n💬 CONVERSATIONS: ${backupData.conversations.length} records (will be skipped - no messages)`);
      console.log(`\\n📧 MESSAGES: ${backupData.messages.length} records (empty)`);
      console.log(`\\n👥 CONTACTS: ${backupData.contacts.length} records (empty)`);

      console.log('\\n💡 To run the actual migration:');
      console.log('  npm run migrate-data');
      console.log('  npm run migrate-data -- --overwrite  (to overwrite existing records)');

    } catch (error) {
      console.error('❌ Preview failed:', error);
    }
  }
}

// CLI handler
export async function runDataMigration() {
  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite') || args.includes('-o');
  const preview = args.includes('--preview') || args.includes('-p');

  const migrator = new DataMigrator();

  try {
    if (preview) {
      await migrator.previewMigration();
      console.log('\n✅ Preview completed successfully!');
    } else {
      await migrator.migrateAll(overwrite);
      console.log('\n✅ Migration process completed!');
    }
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runDataMigration();
}
