import type { Express } from "express";
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from "../db";
import {
  conversations,
  conversationParticipants,
  messages,
  users
} from "@shared/schema";
import { isAuthenticated } from "../temp-auth";

export function setupFreshMessagingRoutes(app: Express) {
  console.log("🚀 REGISTERING FRESH MESSAGING ROUTES");

  // Test endpoint to verify messaging system is working
  app.get("/api/messaging/test", isAuthenticated, async (req, res) => {
    console.log("🧪 MESSAGING TEST - User:", req.user?.id);
    res.json({ 
      status: "Fresh messaging system is working!", 
      user: req.user?.id,
      timestamp: new Date().toISOString()
    });
  });

  // Get all conversations for a user (simplified)
  app.get("/api/messaging/conversations", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      console.log("📋 Getting conversations for user:", userId);

      // For now, let's just get all conversations and see what we have
      const allConversations = await db
        .select({
          id: conversations.id,
          type: conversations.type,
          name: conversations.name,
          createdAt: conversations.createdAt
        })
        .from(conversations)
        .orderBy(desc(conversations.createdAt));

      console.log("📋 Found conversations:", allConversations);
      res.json(allConversations);
    } catch (error) {
      console.error("❌ Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get messages for a conversation (simplified)
  app.get("/api/messaging/conversations/:id/messages", isAuthenticated, async (req, res) => {
    try {
      // Disable caching for development
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const conversationId = parseInt(req.params.id);
      const userId = req.user.id;
      
      console.log(`💬 Getting messages for conversation ${conversationId}, user ${userId}`);

      // For now, let's skip the participant check and just get messages
      const conversationMessages = await db
        .select({
          id: messages.id,
          content: messages.content,
          createdAt: messages.createdAt,
          userId: messages.userId,
          userEmail: users.email,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userDisplayName: users.displayName
        })
        .from(messages)
        .leftJoin(users, eq(messages.userId, users.id))
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt);

      console.log(`💬 Found ${conversationMessages.length} messages`);
      if (conversationMessages.length > 0) {
        console.log(`💬 Sample message:`, JSON.stringify(conversationMessages[0], null, 2));
      }
      
      // Transform messages to include the user object structure that BaseChat expects
      const messagesWithUser = conversationMessages.map(msg => ({
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
        userId: msg.userId,
        conversationId: conversationId,
        // Include user object for better structure
        user: msg.userId ? {
          firstName: msg.userFirstName || '',
          lastName: msg.userLastName || '',
          email: msg.userEmail || '',
          displayName: msg.userDisplayName || undefined
        } : undefined,
        // Keep legacy fields for compatibility
        userEmail: msg.userEmail,
        userFirstName: msg.userFirstName,
        userLastName: msg.userLastName,
        _debug_timestamp: new Date().toISOString()
      }));
      
      res.json(messagesWithUser);
    } catch (error) {
      console.error("❌ Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send a message (simplified)
  app.post("/api/messaging/conversations/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = req.user.id;
      const { content } = req.body;

      console.log(`📤 Sending message to conversation ${conversationId} from user ${userId}`);

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Message content is required" });
      }

      // For now, let's skip participant checks and just send the message
      const [newMessage] = await db
        .insert(messages)
        .values({
          conversationId,
          userId,
          content: content.trim()
        })
        .returning();

      console.log(`📤 Message sent successfully:`, newMessage);
      
      // Get user info for response
      const [user] = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          displayName: users.displayName
        })
        .from(users)
        .where(eq(users.id, userId));

      const messageWithUser = {
        ...newMessage,
        // Include user object for better structure
        user: user ? {
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          email: user.email || '',
          displayName: user.displayName || undefined
        } : undefined,
        // Keep legacy fields for compatibility
        userEmail: user?.email,
        userFirstName: user?.firstName,
        userLastName: user?.lastName
      };

      res.json(messageWithUser);
    } catch (error) {
      console.error("❌ Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Create a new conversation (simplified)
  app.post("/api/messaging/conversations", isAuthenticated, async (req, res) => {
    try {
      const { name, type = "group" } = req.body;
      const userId = req.user!.id;

      console.log(`🆕 Creating conversation: ${name} (${type}) by user ${userId}`);

      if (!name) {
        return res.status(400).json({ message: "Conversation name is required" });
      }

      // Create conversation
      const [conversation] = await db
        .insert(conversations)
        .values({
          type,
          name
        })
        .returning();

      // Add creator as participant
      await db.insert(conversationParticipants).values({
        conversationId: conversation.id,
        userId
      });

      console.log(`🆕 Conversation created:`, conversation);
      res.json(conversation);
    } catch (error) {
      console.error("❌ Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Delete a message
  app.delete("/api/messaging/messages/:id", isAuthenticated, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      const userId = req.user!.id;

      console.log(`🗑️ Deleting message ${messageId} by user ${userId}`);

      // Get the message to check ownership
      const [message] = await db
        .select()
        .from(messages)
        .where(eq(messages.id, messageId));

      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Check if user owns the message or has admin privileges
      const user = req.user as any;
      const isOwner = message.userId === userId;
      const isSuperAdmin = user.role === "super_admin";
      const isAdmin = user.role === "admin";
      const hasModeratePermission = user.permissions?.includes("moderate_messages");

      if (!isOwner && !isSuperAdmin && !isAdmin && !hasModeratePermission) {
        return res.status(403).json({ message: "You can only delete your own messages" });
      }

      // Delete the message
      await db.delete(messages).where(eq(messages.id, messageId));

      console.log(`🗑️ Message ${messageId} deleted successfully`);
      res.status(204).send();
    } catch (error) {
      console.error("❌ Error deleting message:", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });
}
