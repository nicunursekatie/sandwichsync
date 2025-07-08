import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { eq, and, or, sql, desc } from "drizzle-orm";
import express from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import multer from "multer";
import { eq, and, or, sql, desc, asc } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import mammoth from "mammoth";
import { storage } from "./storage-wrapper";
import { sendDriverAgreementNotification } from "./sendgrid";
import { messageNotificationRoutes } from "./routes/message-notifications";
import googleSheetsRoutes from "./routes/google-sheets";
import { setupCleanMessagingRoutes } from "./routes/clean-messaging";
// import { generalRateLimit, strictRateLimit, uploadRateLimit, clearRateLimit } from "./middleware/rateLimiter";
import { sanitizeMiddleware } from "./middleware/sanitizer";
import { requestLogger, errorLogger, logger } from "./middleware/logger";
import {
  insertProjectSchema,
  insertProjectTaskSchema,
  insertProjectCommentSchema,
  insertTaskCompletionSchema,
  insertMessageSchema,
  insertWeeklyReportSchema,
  insertSandwichCollectionSchema,
  insertMeetingMinutesSchema,
  insertAgendaItemSchema,
  insertMeetingSchema,
  insertDriverAgreementSchema,
  insertDriverSchema,
  insertHostSchema,
  insertHostContactSchema,
  insertRecipientSchema,
  insertContactSchema,
  insertAnnouncementSchema,
  drivers,
  projectTasks,
  taskCompletions,
  conversations,
  conversationParticipants,
  messages as messagesTable,
  users,
} from "@shared/schema";

// Extend Request interface to include file metadata
declare global {
  namespace Express {
    interface Request {
      fileMetadata?: {
        fileName: string;
        filePath: string;
        fileType: string;
        mimeType: string;
      };
    }
  }
}
import dataManagementRoutes from "./routes/data-management";
import { registerPerformanceRoutes } from "./routes/performance";
import { SearchEngine } from "./search-engine";
import { CacheManager } from "./performance/cache-manager";
import { ReportGenerator } from "./reporting/report-generator";
import { EmailService } from "./notifications/email-service";
import { VersionControl } from "./middleware/version-control";
import { BackupManager } from "./operations/backup-manager";
import { QueryOptimizer } from "./performance/query-optimizer";
import { db } from "./db";

// Permission middleware to check user roles and permissions
const requirePermission = (permission: string) => {
  return async (req: any, res: any, next: any) => {
    try {
      // Get user from session (assuming temp auth sets user in session)
      const user = req.session?.user || req.user;

      if (!user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user has the required permission
      const hasPermission = checkUserPermission(user, permission);

      if (!hasPermission) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      next();
    } catch (error) {
      res.status(500).json({ message: "Permission check failed" });
    }
  };
};

// Helper function to check permissions
const checkUserPermission = (user: any, permission: string): boolean => {
  // Admin has all permissions
  if (user.role === "admin") return true;

  // Coordinator has most permissions including data editing
  if (user.role === "coordinator") {
    return !["manage_users", "system_admin"].includes(permission);
  }

  // Volunteer has very limited permissions - only read access
  if (user.role === "volunteer") {
    return ["read_collections", "general_chat", "volunteer_chat"].includes(
      permission,
    );
  }

  // Viewer has read-only access
  if (user.role === "viewer") {
    return ["read_collections", "read_reports"].includes(permission);
  }

  return false;
};

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

// Configure multer for meeting minutes file uploads
const meetingMinutesUpload = multer({
  dest: "uploads/temp/", // Use temp directory first
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    const allowedExtensions = [".pdf", ".doc", ".docx"];
    const hasValidMimeType = allowedMimeTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some((ext) =>
      file.originalname.toLowerCase().endsWith(ext),
    );

    if (hasValidMimeType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Only PDF, DOC, and DOCX files are allowed for meeting minutes",
        ),
      );
    }
  },
});

// Configure multer for import operations (memory storage)
const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExtensions = [".csv", ".xls", ".xlsx"];
    const hasValidType = allowedTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some((ext) =>
      file.originalname.toLowerCase().endsWith(ext),
    );

    if (hasValidType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV and Excel files are allowed"));
    }
  },
});

// Configure multer for project files (supports various file types)
const projectFilesUpload = multer({
  dest: "uploads/projects/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
  fileFilter: (req, file, cb) => {
    // Allow most common file types for project documentation
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/zip",
      "application/x-zip-compressed",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not supported"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup PostgreSQL session store for production-ready session persistence
  // This replaces the previous MemoryStore which was causing:
  // - Memory leaks and server crashes every ~5 minutes
  // - Session loss on server restarts
  // - "MemoryStore is not designed for a production environment" warnings
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Auto-create sessions table if it doesn't exist
    ttl: 7 * 24 * 60 * 60, // 7 days TTL (in seconds for pg-simple)
    tableName: "sessions",
    pruneSessionInterval: 60 * 15, // Prune expired sessions every 15 minutes
    errorLog: (error) => {
      console.error('Session store error:', error);
    }
  });

  // Add session middleware with PostgreSQL storage
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "temp-secret-key-for-development",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Should be true in production with HTTPS, false for development
        httpOnly: true, // Prevent XSS attacks
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days for better persistence
        sameSite: "lax", // CSRF protection
        domain: undefined, // Let the browser handle domain for localhost
        path: "/", // Make cookie available to all paths
      },
      name: "tsp.session", // Custom session name
    }),
  );

  // Setup temporary authentication (stable and crash-free)
  const {
    setupTempAuth,
    isAuthenticated,
    requirePermission,
    initializeTempAuth,
  } = await import("./temp-auth");
  setupTempAuth(app);

  // Initialize with default admin user for persistent login
  await initializeTempAuth();

  // Import and register signup routes
  const { signupRoutes } = await import("./routes/signup");
  app.use("/api", signupRoutes);

  // Comprehensive debug endpoints for authentication troubleshooting
  app.get("/api/debug/session", async (req: any, res) => {
    try {
      const sessionUser = req.session?.user;
      const reqUser = req.user;

      res.json({
        hasSession: !!req.session,
        sessionId: req.sessionID,
        sessionStore: !!sessionStore,
        sessionUser: sessionUser
          ? {
              id: sessionUser.id,
              email: sessionUser.email,
              role: sessionUser.role,
              isActive: sessionUser.isActive,
            }
          : null,
        reqUser: reqUser
          ? {
              id: reqUser.id,
              email: reqUser.email,
              role: reqUser.role,
              isActive: reqUser.isActive,
            }
          : null,
        cookies: req.headers.cookie,
        userAgent: req.headers["user-agent"],
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
      });
    } catch (error) {
      console.error("Debug session error:", error);
      res.status(500).json({ error: "Failed to get session info" });
    }
  });

  // Debug endpoint to check authentication status
  app.get("/api/debug/auth-status", async (req: any, res) => {
    try {
      const user = req.session?.user || req.user;

      res.json({
        isAuthenticated: !!user,
        sessionExists: !!req.session,
        userInSession: !!req.session?.user,
        userInRequest: !!req.user,
        userId: user?.id || null,
        userEmail: user?.email || null,
        userRole: user?.role || null,
        sessionId: req.sessionID,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Debug auth status error:", error);
      res.status(500).json({ error: "Failed to get auth status" });
    }
  });

  // Auth routes - Fixed to work with temp auth system
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      // Get user from session (temp auth) or req.user (Replit auth)
      const user = req.session?.user || req.user;

      if (!user) {
        return res.status(401).json({ message: "No user in session" });
      }

      // For temp auth, user is directly in session
      if (req.session?.user) {
        res.json(user);
        return;
      }

      // For Replit auth, get user from database
      const userId = req.user.claims?.sub || req.user.id;
      const dbUser = await storage.getUser(userId);
      res.json(dbUser || user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Import and use the new modular routes
  const routesModule = await import("./routes/index");
  if (routesModule.apiRoutes) {
    app.use(routesModule.apiRoutes);
  }

  // Register performance optimization routes
  registerPerformanceRoutes(app);
  // Apply global middleware
  app.use(requestLogger);
  // Temporarily disable rate limiting to fix sandwich collections
  // app.use(generalRateLimit);
  app.use(sanitizeMiddleware);

  // User management routes
  app.get(
    "/api/users",
    isAuthenticated,
    requirePermission("view_users"),
    async (req, res) => {
      try {
        const users = await storage.getAllUsers();
        res.json(users);
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Failed to fetch users" });
      }
    },
  );

  app.patch(
    "/api/users/:id",
    isAuthenticated,
    requirePermission("manage_users"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { role, permissions, firstName, lastName, displayName } = req.body;
        
        // Build updates object with only provided fields
        const updates: any = {};
        if (role !== undefined) updates.role = role;
        if (permissions !== undefined) updates.permissions = permissions;
        if (firstName !== undefined) updates.firstName = firstName;
        if (lastName !== undefined) updates.lastName = lastName;
        if (displayName !== undefined) updates.displayName = displayName;
        
        const updatedUser = await storage.updateUser(id, updates);
        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ message: "Failed to update user" });
      }
    },
  );

  app.patch(
    "/api/users/:id/status",
    isAuthenticated,
    requirePermission("manage_users"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { isActive } = req.body;
        const updatedUser = await storage.updateUser(id, { isActive });
        res.json(updatedUser);
      } catch (error) {
        console.error("Error updating user status:", error);
        res.status(500).json({ message: "Failed to update user status" });
      }
    },
  );

  app.delete(
    "/api/users/:id",
    isAuthenticated,
    requirePermission("manage_users"),
    async (req, res) => {
      try {
        const { id } = req.params;
        await storage.deleteUser(id);
        res.json({ success: true, message: "User deleted successfully" });
      } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Failed to delete user" });
      }
    },
  );

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      logger.error("Failed to fetch projects", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post(
    "/api/projects",
    requirePermission("edit_data"),
    async (req, res) => {
      try {
        console.log("Received project data:", req.body);
        const projectData = insertProjectSchema.parse(req.body);
        console.log("Parsed project data:", projectData);
        const project = await storage.createProject(projectData);
        res.status(201).json(project);
      } catch (error) {
        console.error("Project creation error details:", error);
        logger.error("Failed to create project", error);
        res.status(400).json({
          message: "Invalid project data",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  app.post("/api/projects/:id/claim", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { assigneeName } = req.body;

      const updatedProject = await storage.updateProject(id, {
        status: "in_progress",
        assigneeName: assigneeName || "You",
      });

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(updatedProject);
    } catch (error) {
      res.status(500).json({ message: "Failed to claim project" });
    }
  });

  // Task completion routes for multi-user tasks
  app.post("/api/tasks/:taskId/complete", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = req.session?.user;
      const { notes } = req.body;

      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Check if user is assigned to this task
      const task = await storage.getTaskById(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }

      const assigneeIds = task.assigneeIds || [];
      if (!assigneeIds.includes(user.id)) {
        return res
          .status(403)
          .json({ error: "You are not assigned to this task" });
      }

      // Add completion record
      const completionData = insertTaskCompletionSchema.parse({
        taskId: taskId,
        userId: user.id,
        userName: user.displayName || user.email,
        notes: notes,
      });

      const completion = await storage.createTaskCompletion(completionData);

      // Check completion status
      const allCompletions = await storage.getTaskCompletions(taskId);
      const isFullyCompleted = allCompletions.length >= assigneeIds.length;

      // If all users completed, update task status
      if (isFullyCompleted && task.status !== "completed") {
        await storage.updateTaskStatus(taskId, "completed");
      }

      res.json({
        completion: completion,
        isFullyCompleted,
        totalCompletions: allCompletions.length,
        totalAssignees: assigneeIds.length,
      });
    } catch (error) {
      console.error("Error completing task:", error);
      res.status(500).json({ error: "Failed to complete task" });
    }
  });

  // Remove completion by current user
  app.delete("/api/tasks/:taskId/complete", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const user = req.session?.user;

      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Remove completion record
      const success = await storage.removeTaskCompletion(taskId, user.id);
      if (!success) {
        return res.status(404).json({ error: "Completion not found" });
      }

      // Update task status back to in_progress if it was completed
      const task = await storage.getTaskById(taskId);
      if (task?.status === "completed") {
        await storage.updateTaskStatus(taskId, "in_progress");
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing completion:", error);
      res.status(500).json({ error: "Failed to remove completion" });
    }
  });

  // Get task completions
  app.get("/api/tasks/:taskId/completions", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const completions = await storage.getTaskCompletions(taskId);
      res.json(completions);
    } catch (error) {
      console.error("Error fetching completions:", error);
      res.status(500).json({ error: "Failed to fetch completions" });
    }
  });

  app.put(
    "/api/projects/:id",
    requirePermission("edit_data"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updates = req.body;

        // Filter out timestamp fields that shouldn't be updated directly
        const { createdAt, updatedAt, ...validUpdates } = updates;

        const updatedProject = await storage.updateProject(id, validUpdates);

        if (!updatedProject) {
          return res.status(404).json({ message: "Project not found" });
        }

        res.json(updatedProject);
      } catch (error) {
        logger.error("Failed to update project", error);
        res.status(500).json({ message: "Failed to update project" });
      }
    },
  );

  app.patch(
    "/api/projects/:id",
    requirePermission("edit_data"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        const updates = req.body;

        // Filter out timestamp fields that shouldn't be updated directly
        const { createdAt, updatedAt, ...validUpdates } = updates;

        const updatedProject = await storage.updateProject(id, validUpdates);

        if (!updatedProject) {
          return res.status(404).json({ message: "Project not found" });
        }

        res.json(updatedProject);
      } catch (error) {
        logger.error("Failed to update project", error);
        res.status(500).json({ message: "Failed to update project" });
      }
    },
  );

  app.delete(
    "/api/projects/:id",
    requirePermission("edit_data"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const deleted = await storage.deleteProject(id);
        if (!deleted) {
          return res.status(404).json({ message: "Project not found" });
        }

        res.status(204).send();
      } catch (error) {
        logger.error("Failed to delete project", error);
        res.status(500).json({ message: "Failed to delete project" });
      }
    },
  );

  // Project Files
  app.post(
    "/api/projects/:id/files",
    projectFilesUpload.array("files"),
    async (req, res) => {
      try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: "Invalid project ID" });
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ message: "No files uploaded" });
        }

        // Process uploaded files and return metadata
        const fileMetadata = files.map((file) => ({
          name: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          path: file.path,
          uploadedAt: new Date().toISOString(),
        }));

        res.status(201).json({
          message: "Files uploaded successfully",
          files: fileMetadata,
        });
      } catch (error) {
        logger.error("Failed to upload project files", error);
        res.status(500).json({ message: "Failed to upload files" });
      }
    },
  );

  app.get("/api/projects/:id/files", async (req, res) => {
    try {
      const projectId = parseInt(req.params.id);
      if (isNaN(projectId)) {
        return res.status(400).json({ message: "Invalid project ID" });
      }

      // For now, return empty array as file storage is basic
      // In a production app, you'd store file metadata in database
      res.json([]);
    } catch (error) {
      logger.error("Failed to fetch project files", error);
      res.status(500).json({ message: "Failed to fetch files" });
    }
  });

  // Messages - disable ALL caching middleware for this endpoint
  // Messages - Fixed to work with actual database schema
  app.get("/api/messages", async (req, res) => {
    try {
      const conversationId = req.query.conversationId
        ? parseInt(req.query.conversationId as string)
        : null;
      const chatType = req.query.chatType as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;

      console.log(
        `[DEBUG] Getting messages - conversationId: ${conversationId}, chatType: ${chatType}`,
      );

      let messages;

      if (conversationId) {
        // Get messages for specific conversation
        const result = await db
          .select({
            id: messagesTable.id,
            content: messagesTable.content,
            userId: messagesTable.userId,
            conversationId: messagesTable.conversationId,
            createdAt: messagesTable.createdAt,
            // Join with users to get sender info
            userFirstName: users.firstName,
            userLastName: users.lastName,
            userEmail: users.email,
            userDisplayName: users.displayName,
          })
          .from(messagesTable)
          .leftJoin(users, eq(messagesTable.userId, users.id))
          .where(eq(messagesTable.conversationId, conversationId))
          .orderBy(messagesTable.createdAt)
          .limit(limit);

        // Transform to match expected format
        messages = result.map((msg) => ({
          id: msg.id,
          content: msg.content,
          userId: msg.userId,
          conversationId: msg.conversationId,
          createdAt: msg.createdAt,
          // Create sender field from user data
          sender:
            msg.userDisplayName ||
            `${msg.userFirstName || ""} ${msg.userLastName || ""}`.trim() ||
            msg.userEmail?.split("@")[0] ||
            "Unknown User",
          // Legacy compatibility fields
          timestamp: msg.createdAt,
          committee: chatType || "general",
        }));
      } else if (chatType) {
        // Handle chat types by finding/creating appropriate conversation
        let conversation;

        // Try to find existing conversation for this chat type
        const existingConversations = await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.type, "channel"),
              eq(conversations.name, chatType),
            ),
          );

        if (existingConversations.length > 0) {
          conversation = existingConversations[0];
        } else {
          // Create new conversation for this chat type
          const newConversations = await db
            .insert(conversations)
            .values({
              type: "channel",
              name: chatType,
            })
            .returning();
          conversation = newConversations[0];
        }

        // Get messages for this conversation
        const result = await db
          .select({
            id: messagesTable.id,
            content: messagesTable.content,
            userId: messagesTable.userId,
            conversationId: messagesTable.conversationId,
            createdAt: messagesTable.createdAt,
            userFirstName: users.firstName,
            userLastName: users.lastName,
            userEmail: users.email,
            userDisplayName: users.displayName,
          })
          .from(messagesTable)
          .leftJoin(users, eq(messagesTable.userId, users.id))
          .where(eq(messagesTable.conversationId, conversation.id))
          .orderBy(messagesTable.createdAt)
          .limit(limit);

        messages = result.map((msg) => ({
          id: msg.id,
          content: msg.content,
          userId: msg.userId,
          conversationId: msg.conversationId,
          createdAt: msg.createdAt,
          sender:
            msg.userDisplayName ||
            `${msg.userFirstName || ""} ${msg.userLastName || ""}`.trim() ||
            msg.userEmail?.split("@")[0] ||
            "Unknown User",
          timestamp: msg.createdAt,
          committee: chatType,
        }));
      } else {
        // Get recent messages from all conversations
        const result = await db
          .select({
            id: messagesTable.id,
            content: messagesTable.content,
            userId: messagesTable.userId,
            conversationId: messagesTable.conversationId,
            createdAt: messagesTable.createdAt,
            userFirstName: users.firstName,
            userLastName: users.lastName,
            userEmail: users.email,
            userDisplayName: users.displayName,
          })
          .from(messagesTable)
          .leftJoin(users, eq(messagesTable.userId, users.id))
          .orderBy(desc(messagesTable.createdAt))
          .limit(limit);

        messages = result.map((msg) => ({
          id: msg.id,
          content: msg.content,
          userId: msg.userId,
          conversationId: msg.conversationId,
          createdAt: msg.createdAt,
          sender:
            msg.userDisplayName ||
            `${msg.userFirstName || ""} ${msg.userLastName || ""}`.trim() ||
            msg.userEmail?.split("@")[0] ||
            "Unknown User",
          timestamp: msg.createdAt,
          committee: "general",
        }));
      }

      console.log(`[DEBUG] Returning ${messages.length} messages`);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post(
    "/api/messages",
    requirePermission("send_messages"),
    async (req, res) => {
      try {
        const messageData = insertMessageSchema.parse(req.body);
        // Add user ID to message data if user is authenticated
        // ENHANCED: Add debug logging for message creation
        const messageWithUser = {
          ...messageData,
          userId: req.user?.id || null,
        };
        console.log(
          `📤 CREATING MESSAGE: committee=${messageData.committee}, threadId=${messageData.threadId}, userId=${req.user?.id}`,
        );
        const message = await storage.createMessage(messageWithUser);
        console.log(
          `✅ MESSAGE CREATED: id=${message.id}, threadId=${message.threadId}`,
        );

        // Broadcast new message notification to connected clients
        if (typeof (global as any).broadcastNewMessage === "function") {
          await (global as any).broadcastNewMessage(message);
        }

        res.status(201).json(message);
      } catch (error) {
        res.status(400).json({ message: "Invalid message data" });
      }
    },
  );

  // REMOVED OLD ENDPOINT - using new conversation system instead

  app.delete(
    "/api/messages/:id",
    requirePermission("send_messages"),
    async (req, res) => {
      try {
        const id = parseInt(req.params.id);

        // Check if user is authenticated
        if (!req.user?.id) {
          return res.status(401).json({ message: "Authentication required" });
        }

        // Get message to check ownership
        const message = await storage.getMessageById(id);
        if (!message) {
          return res.status(404).json({ message: "Message not found" });
        }

        // Check if user owns the message or has admin privileges
        const user = req.user as any;
        const isOwner = message.userId === user.id;
        const isSuperAdmin = user.role === "super_admin";
        const isAdmin = user.role === "admin";
        const hasModeratePermission =
          user.permissions?.includes("moderate_messages");

        if (!isOwner && !isSuperAdmin && !isAdmin && !hasModeratePermission) {
          return res
            .status(403)
            .json({ message: "You can only delete your own messages" });
        }

        const deleted = await storage.deleteMessage(id);
        if (!deleted) {
          return res.status(404).json({ message: "Message not found" });
        }
        res.status(204).send();
      } catch (error) {
        logger.error("Failed to delete message", error);
        res.status(500).json({ message: "Failed to delete message" });
      }
    },
  );

  // Message unread counts endpoint
  app.get("/api/messages/unread-counts", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // For now, return empty counts - you can implement actual counting logic later
      const unreadCounts = {
        general: 0,
        committee: 0,
        hosts: 0,
        drivers: 0,
        recipients: 0,
        core_team: 0,
        direct: 0,
        groups: 0,
        total: 0
      };

      res.json(unreadCounts);
    } catch (error) {
      console.error("Error fetching unread counts:", error);
      res.status(500).json({ message: "Failed to fetch unread counts" });
    }
  });

  // Mark all messages as read endpoint
  app.post("/api/messages/mark-all-read", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Implementation would go here
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  // Simple conversation API endpoints for the new 3-table messaging system
  app.get("/api/conversations", isAuthenticated, async (req, res) => {
    console.log("=== /api/conversations REQUEST ===");
    console.log("Headers:", req.headers);
    console.log("Session ID:", req.sessionID);
    console.log("Session data:", req.session);
    console.log("User from req:", (req as any).user);
    
    try {
      const user = (req as any).user;
      if (!user?.id) {
        console.log("No user ID found, returning 401");
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get conversations the user is a participant in
      let userConversations;
      // Get all channel conversations (these are public) and user's private conversations
      userConversations = await db
        .select({
          id: conversations.id,
          type: conversations.type,
          name: conversations.name,
          createdAt: conversations.createdAt,
        })
        .from(conversations)
        .leftJoin(
          conversationParticipants,
          eq(conversations.id, conversationParticipants.conversationId),
        )
        .where(
          or(
            eq(conversations.type, "channel"), // All channel conversations are accessible
            eq(conversationParticipants.userId, user.id), // User's private conversations
          ),
        )
        .groupBy(
          conversations.id,
          conversations.type,
          conversations.name,
          conversations.createdAt,
        )
        .orderBy(desc(conversations.createdAt));

      res.json(userConversations);
    } catch (error) {
      console.error("[API] Error fetching conversations:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { type, name, participants = [] } = req.body;

      // Create conversation
      const [conversation] = await db
        .insert(conversations)
        .values({
          type,
          name: name || null,
        })
        .returning();

      // Add participants
      const participantData = participants.map((userId: string) => ({
        conversationId: conversation.id,
        userId,
      }));

      if (participantData.length > 0) {
        await db.insert(conversationParticipants).values(participantData);
      }

      res.json(conversation);
    } catch (error) {
      console.error("[API] Error creating conversation:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(
    "/api/conversations/:id/messages",
    isAuthenticated,
    async (req, res) => {
      try {
        const user = (req as any).user;
        if (!user?.id) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const conversationId = parseInt(req.params.id);

        // Check access: participant in conversation OR channel conversations are public
        const [conversation] = await db
          .select({ type: conversations.type })
          .from(conversations)
          .where(eq(conversations.id, conversationId));

        console.log(`🔍 [MAIN ROUTES] Conversation ${conversationId}:`, conversation);

        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        // Channel conversations are accessible to all users
        if (conversation.type !== "channel") {
          console.log(`🔍 [MAIN ROUTES] Non-channel conversation, checking participants for user ${user.id}`);
          const [participant] = await db
            .select()
            .from(conversationParticipants)
            .where(
              and(
                eq(conversationParticipants.conversationId, conversationId),
                eq(conversationParticipants.userId, user.id),
              ),
            );

          if (!participant) {
            console.log(`❌ [MAIN ROUTES] User ${user.id} not found as participant`);
            return res.status(403).json({ message: "Access denied" });
          }
        } else {
          console.log(`✅ [MAIN ROUTES] Channel conversation - allowing access for user ${user.id}`);
        }

        const conversationMessages = await db
          .select({
            id: messagesTable.id,
            content: messagesTable.content,
            userId: messagesTable.userId,
            sender: messagesTable.sender,
            createdAt: messagesTable.createdAt,
            updatedAt: messagesTable.updatedAt,
            timestamp: messagesTable.timestamp,
            // Include user data for proper display
            userFirstName: users.firstName,
            userLastName: users.lastName,
            userEmail: users.email,
            userDisplayName: users.displayName,
          })
          .from(messagesTable)
          .leftJoin(users, eq(messagesTable.userId, users.id))
          .where(eq(messagesTable.conversationId, conversationId))
          .orderBy(messagesTable.createdAt);

        // Transform to match expected format
        const formattedMessages = conversationMessages.map((msg) => ({
          id: msg.id,
          content: msg.content,
          userId: msg.userId,
          createdAt: msg.createdAt,
          // Include user info for frontend display
          userFirstName: msg.userFirstName,
          userLastName: msg.userLastName,
          userEmail: msg.userEmail,
          userDisplayName: msg.userDisplayName,
          // Legacy fields for compatibility
          sender:
            msg.userDisplayName ||
            msg.userFirstName ||
            msg.userEmail?.split("@")[0] ||
            "Unknown User",
          timestamp: msg.timestamp || msg.createdAt,
          committee: "conversation",
        }));

        res.json(formattedMessages);
      } catch (error) {
        console.error("[API] Error fetching messages:", error);
        res
          .status(500)
          .json({ message: "Internal server error", details: error.message });
      }
    },
  );

  app.post(
    "/api/conversations/:id/messages",
    isAuthenticated,
    async (req, res) => {
      try {
        const user = (req as any).user;
        if (!user?.id) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const conversationId = parseInt(req.params.id);
        const { content } = req.body;

        if (!content || !content.trim()) {
          return res
            .status(400)
            .json({ message: "Message content is required" });
        }

        // Check access: participant in conversation OR channel conversations are public
        const [conversation] = await db
          .select({ type: conversations.type })
          .from(conversations)
          .where(eq(conversations.id, conversationId));

        if (!conversation) {
          return res.status(404).json({ message: "Conversation not found" });
        }

        // Channel conversations are accessible to all users
        if (conversation.type !== "channel") {
          const [participant] = await db
            .select()
            .from(conversationParticipants)
            .where(
              and(
                eq(conversationParticipants.conversationId, conversationId),
                eq(conversationParticipants.userId, user.id),
              ),
            );

          if (!participant) {
            return res.status(403).json({ message: "Access denied" });
          }
        }

        const userName =
          `${user.firstName} ${user.lastName}` || user.email || "Unknown User";

        const [message] = await db
          .insert(messagesTable)
          .values({
            conversationId,
            userId: user.id,
            content: content.trim(),
            sender: userName,
          })
          .returning();

        // Broadcast via WebSocket if available
        if (broadcastNewMessage) {
          broadcastNewMessage({
            type: "new_message",
            conversationId,
            message: {
              id: message.id,
              content: message.content,
              userId: message.userId,
              sender: userName,
              timestamp: message.createdAt,
            },
          });
        }

        res.json(message);
      } catch (error) {
        console.error("[API] Error sending message:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // Create or get direct conversation between two users
  app.post("/api/conversations/direct", isAuthenticated, async (req, res) => {
    console.log("=== POST /api/conversations/direct START ===");
    try {
      const user = (req as any).user;
      console.log("User:", user);
      console.log("Request body:", req.body);

      const { otherUserId } = req.body;

      if (!otherUserId) {
        return res.status(400).json({ message: "Other user ID is required" });
      }

      // Check if direct conversation already exists between these users
      const existingConversation = await db
        .select({
          id: conversations.id,
          type: conversations.type,
          name: conversations.name,
          createdAt: conversations.createdAt,
        })
        .from(conversations)
        .innerJoin(
          conversationParticipants,
          eq(conversations.id, conversationParticipants.conversationId),
        )
        .where(
          and(
            eq(conversations.type, "direct"),
            eq(conversationParticipants.userId, user.id),
          ),
        );

      // Find conversation that includes both users
      for (const conv of existingConversation) {
        const participants = await db
          .select({ userId: conversationParticipants.userId })
          .from(conversationParticipants)
          .where(eq(conversationParticipants.conversationId, conv.id));

        const userIds = participants.map((p) => p.userId);
        if (userIds.includes(otherUserId) && userIds.length === 2) {
          return res.json(conv);
        }
      }

      // Create new direct conversation
      const [newConversation] = await db
        .insert(conversations)
        .values({
          type: "direct",
          name: null,
        })
        .returning();

      // Add both users as participants
      await db.insert(conversationParticipants).values([
        {
          conversationId: newConversation.id,
          userId: user.id,
        },
        {
          conversationId: newConversation.id,
          userId: otherUserId,
        },
      ]);

      res.json(newConversation);
    } catch (error) {
      console.error("=== POST /api/conversations/direct ERROR ===");
      console.error("[ERROR] Full error object:", error);
      console.error("[ERROR] Error name:", error.name);
      console.error("[ERROR] Error message:", error.message);
      console.error("[ERROR] Error stack:", error.stack);
      if (error.code) console.error("[ERROR] Error code:", error.code);
      if (error.detail) console.error("[ERROR] Error detail:", error.detail);
      if (error.hint) console.error("[ERROR] Error hint:", error.hint);
      console.error("=== POST /api/conversations/direct ERROR END ===");

      res.status(500).json({
        message: "Failed to create conversation",
        error: error.message,
        details: error.detail || "No additional details",
      });
    }
  });

  // CSV Import for Sandwich Collections
  app.post(
    "/api/import-collections",
    upload.single("csvFile"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No CSV file uploaded" });
        }

        const csvContent = await fs.readFile(req.file.path, "utf-8");
        logger.info(`CSV content preview: ${csvContent.substring(0, 200)}...`);

        // Parse CSV with enhanced error handling for nested JSON
        let records = [];
        try {
          records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            delimiter: ",",
            quote: '"',
            escape: '"',
            relax_quotes: true, // Allow unescaped quotes
            relax_column_count: true, // Allow varying column counts
          });
        } catch (parseError) {
          logger.warn("Standard parsing failed, trying manual parsing", { error: parseError });
          // Fall back to manual parsing for complex cases with nested JSON
          records = parseCSVManually(csvContent);
        }

        logger.info(`Parsed ${records.length} records`);
        if (records.length > 0) {
          logger.info(`First record keys: ${Object.keys(records[0]).join(', ')}`);
        }

        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        // Process each record
        for (let i = 0; i < records.length; i++) {
          const record = records[i];

          try {
            // Check for alternative column names
            const hostName =
              record["Host Name"] ||
              record["Host"] ||
              record["host_name"] ||
              record["HostName"];
            const sandwichCountStr =
              record["Individual Sandwiches"] ||
              record["Sandwich Count"] ||
              record["Count"] ||
              record["sandwich_count"] ||
              record["SandwichCount"] ||
              record["Sandwiches"];
            const date =
              record["Collection Date"] ||
              record["Date"] ||
              record["date"] ||
              record["CollectionDate"];

            // Validate required fields
            if (!hostName) {
              const availableKeys = Object.keys(record).join(", ");
              throw new Error(
                `Missing Host Name (available columns: ${availableKeys}) in row ${i + 1}`,
              );
            }
            if (!sandwichCountStr) {
              const availableKeys = Object.keys(record).join(", ");
              throw new Error(
                `Missing Individual Sandwiches (available columns: ${availableKeys}) in row ${i + 1}`,
              );
            }
            if (!date) {
              const availableKeys = Object.keys(record).join(", ");
              throw new Error(
                `Missing Collection Date (available columns: ${availableKeys}) in row ${i + 1}`,
              );
            }

            // Parse sandwich count as integer
            const sandwichCount = parseInt(sandwichCountStr.toString().trim());
            if (isNaN(sandwichCount)) {
              throw new Error(
                `Invalid sandwich count "${sandwichCountStr}" in row ${i + 1}`,
              );
            }

            // Parse dates
            let collectionDate = date;
            let submittedAt = new Date();

            // Try to parse Submitted At if provided
            const submittedAtStr =
              record["Submitted At"] ||
              record["Created At"] ||
              record["created_at"] ||
              record["CreatedAt"];
            if (submittedAtStr) {
              const parsedDate = new Date(submittedAtStr);
              if (!isNaN(parsedDate.getTime())) {
                submittedAt = parsedDate;
              }
            }

            // Handle Group Collections data - preserve JSON structure if present
            const groupCollectionsStr = record["Group Collections"] || "";
            let groupCollections = "[]";
            if (groupCollectionsStr && groupCollectionsStr.trim() !== "") {
              try {
                // Try to parse as JSON first
                JSON.parse(groupCollectionsStr);
                groupCollections = groupCollectionsStr;
              } catch {
                // If not JSON, check if it's a number
                const groupCount = parseInt(groupCollectionsStr.trim());
                if (!isNaN(groupCount) && groupCount > 0) {
                  groupCollections = JSON.stringify([
                    { count: groupCount, description: "Group Collection" },
                  ]);
                }
              }
            }

            // Create sandwich collection
            await storage.createSandwichCollection({
              hostName: hostName.trim(),
              individualSandwiches: sandwichCount,
              collectionDate: collectionDate.trim(),
              groupCollections: groupCollections,
              submittedAt: submittedAt,
            });

            successCount++;
          } catch (error) {
            errorCount++;
            const errorMsg = `Row ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`;
            errors.push(errorMsg);
            logger.error(errorMsg);
          }
        }

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        const result = {
          totalRecords: records.length,
          successCount,
          errorCount,
          errors: errors.slice(0, 10), // Return first 10 errors
        };

        logger.info(`CSV import completed: ${successCount}/${records.length} successful`);
        res.json(result);
      } catch (error) {
        logger.error("CSV import failed:", error);
        res.status(500).json({
          message: "CSV import failed",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
  );

  // Return the HTTP server
  const httpServer = createServer(app);

  // Initialize WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/notifications'
  });

  // Store connected clients with their user information
  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection established');
    
    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'identify') {
          // Store client connection with user ID
          const userId = data.userId;
          if (userId) {
            clients.set(userId, ws);
            console.log(`WebSocket client identified: userId=${userId}`);
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Remove client from map
      clients.forEach((client, userId) => {
        if (client === ws) {
          clients.delete(userId);
          console.log(`WebSocket client disconnected: userId=${userId}`);
        }
      })
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Define broadcast functions
  const broadcastNewMessage = async (message: any) => {
    console.log('Broadcasting new message:', message);
    
    // Send to all connected clients
    clients.forEach((client, userId) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify({
            type: 'new_message',
            message: message,
            timestamp: new Date().toISOString()
          }));
        } catch (error) {
          console.error(`Failed to send message to user ${userId}:`, error);
        }
      }
    })
  };

  const broadcastTaskAssignment = async (task: any) => {
    console.log('Broadcasting task assignment:', task);
    
    // Send to specific assigned users
    if (task.assignedTo && Array.isArray(task.assignedTo)) {
      for (const userId of task.assignedTo) {
        const client = clients.get(userId.toString());
        if (client && client.readyState === WebSocket.OPEN) {
          try {
            client.send(JSON.stringify({
              type: 'task_assigned',
              task: task,
              timestamp: new Date().toISOString()
            }));
          } catch (error) {
            console.error(`Failed to send task to user ${userId}:`, error);
          }
        }
      }
    }
  };

  // Make broadcast functions globally available
  (global as any).broadcastNewMessage = broadcastNewMessage;
  (global as any).broadcastTaskAssignment = broadcastTaskAssignment;

  // Setup clean messaging routes
  setupCleanMessagingRoutes(app);

  return httpServer;
}

// Manual CSV parsing function to handle complex JSON content within CSV fields
function parseCSVManually(csvContent: string): any[] {
  const lines = csvContent.split("\n");
  if (lines.length === 0) return [];

  // Get headers from first line
  const headerLine = lines[0];
  const headers = headerLine.split(",").map(h => h.replace(/^"|"$/g, "").trim());

  const records = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // For this specific CSV format, we know the structure:
    // ID,Host Name,Individual Sandwiches,Collection Date,Group Collections,Submitted At
    
    // Split by comma but be careful with quoted content
    const fields = [];
    let currentField = '';
    let inQuotes = false;
    let quoteCount = 0;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        quoteCount++;
        // Handle nested quotes - if we have JSON content with quotes
        if (inQuotes && line[j + 1] === '"') {
          currentField += '"';
          j++; // Skip the next quote
        } else {
          inQuotes = !inQuotes;
          if (!inQuotes || j === 0 || line[j - 1] === ',') {
            // Don't add the quote character to the field content
          } else {
            currentField += char;
          }
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    
    // Add the last field
    if (currentField) {
      fields.push(currentField.trim());
    }

    // Create record object
    if (fields.length >= headers.length) {
      const record: any = {};
      for (let k = 0; k < headers.length; k++) {
        record[headers[k]] = fields[k] || '';
      }
      records.push(record);
    }
  }

  return records;
}
