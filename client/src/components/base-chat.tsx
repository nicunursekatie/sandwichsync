import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { MessageWithUser } from "@shared/schema";

interface BaseChatProps {
  conversationId: number;
  conversationName: string;
  placeholder?: string;
  headerIcon?: React.ReactNode;
  headerActions?: React.ReactNode;
  showUserList?: boolean;
  className?: string;
}

export default function BaseChat({
  conversationId,
  conversationName,
  placeholder = "Type a message...",
  headerIcon,
  headerActions,
  showUserList = false,
  className = ""
}: BaseChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery<MessageWithUser[]>({
    queryKey: ["/api/messaging/conversations", conversationId, "messages"],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/messaging/conversations/${conversationId}/messages`);
      const data = await response.json();
      console.log(`📨 [BaseChat] Fetched ${data.length} messages for conversation ${conversationId}:`, 
        data.slice(0, 2).map((m: any) => ({
          id: m.id,
          userId: m.userId,
          hasUser: !!m.user,
          userFields: m.user,
          legacyFields: { email: m.userEmail, firstName: m.userFirstName, lastName: m.userLastName }
        }))
      );
      return data;
    },
    enabled: !!conversationId,
    refetchInterval: 5000 // Refresh every 5 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('POST', `/api/messaging/conversations/${conversationId}/messages`, {
        content
      });
      return await response.json();
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ 
        queryKey: ["/api/messaging/conversations", conversationId, "messages"] 
      });
      // Scroll to bottom after sending
      setTimeout(() => scrollToBottom(), 100);
    },
    onError: (error) => {
      console.error("Failed to send message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      console.log(`🗑️ [BaseChat] Attempting to delete message ${messageId} from conversation ${conversationId}`);
      return await apiRequest('DELETE', `/api/messaging/messages/${messageId}`);
    },
    onSuccess: () => {
      console.log(`✅ [BaseChat] Message deleted successfully, invalidating cache for conversation ${conversationId}`);
      queryClient.invalidateQueries({ 
        queryKey: ["/api/messaging/conversations", conversationId, "messages"] 
      });
      toast({
        title: "Message deleted",
        description: "The message has been removed",
      });
    },
    onError: (error) => {
      console.error(`❌ [BaseChat] Failed to delete message:`, error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    sendMessageMutation.mutate(newMessage.trim());
  };

  const canDeleteMessage = (message: MessageWithUser) => {
    const currentUser = user as any;
    const isOwner = message.userId === currentUser?.id;
    const isSuperAdmin = currentUser?.role === "super_admin";
    const isAdmin = currentUser?.role === "admin";
    const hasModeratePermission = currentUser?.permissions?.includes("moderate_messages");
    
    const canDelete = isOwner || isSuperAdmin || isAdmin || hasModeratePermission;
    
    console.log(`🔍 [BaseChat] Can delete message ${message.id}?`, {
      messageId: message.id,
      messageUserId: message.userId,
      currentUserId: currentUser?.id,
      currentUserRole: currentUser?.role,
      isOwner,
      isSuperAdmin,
      isAdmin,
      hasModeratePermission,
      canDelete
    });
    
    return canDelete;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toDateString();
    
    if (date.toDateString() === today) {
      return "Today";
    } else if (date.toDateString() === yesterday) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const getUserDisplayName = (message: MessageWithUser) => {
    // Priority: user object > legacy fields > fallback
    if (message.user) {
      if (message.user.displayName) return message.user.displayName;
      const fullName = `${message.user.firstName || ''} ${message.user.lastName || ''}`.trim();
      if (fullName) return fullName;
      return message.user.email?.split('@')[0] || 'Unknown User';
    }
    
    // Legacy compatibility
    const legacyName = `${message.userFirstName || ''} ${message.userLastName || ''}`.trim();
    if (legacyName) return legacyName;
    if (message.userEmail) return message.userEmail.split('@')[0];
    
    return 'Unknown User';
  };

  const getUserInitials = (message: MessageWithUser) => {
    const displayName = getUserDisplayName(message);
    const parts = displayName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
  };

  if (messagesLoading) {
    return (
      <Card className={`h-full flex flex-col ${className}`}>
        <CardHeader className="border-b">
          <div className="flex items-center gap-2">
            {headerIcon}
            <h3 className="font-semibold">{conversationName}</h3>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-muted-foreground">Loading messages...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {headerIcon}
            <h3 className="font-semibold">{conversationName}</h3>
          </div>
          {headerActions}
        </div>
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p className="text-lg font-medium mb-2">No messages yet</p>
                <p className="text-sm">Start the conversation!</p>
              </div>
            ) : (
              <>
                {messages.map((message, index) => {
                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const showDate = !prevMessage || 
                    formatDate(message.createdAt!) !== formatDate(prevMessage.createdAt!);
                  const showAvatar = !prevMessage || 
                    prevMessage.userId !== message.userId ||
                    showDate;

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="bg-muted px-3 py-1 rounded-full text-xs font-medium text-muted-foreground">
                            {formatDate(message.createdAt!)}
                          </span>
                        </div>
                      )}
                      
                      <div className={`flex gap-3 group ${showAvatar ? 'mt-4' : 'mt-1'}`}>
                        <div className="w-8 h-8 flex-shrink-0">
                          {showAvatar && (
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">
                                {getUserInitials(message)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {showAvatar && (
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {getUserDisplayName(message)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(message.createdAt!)}
                              </span>
                            </div>
                          )}
                          
                          <div className="flex items-start gap-2">
                            <div className="text-sm text-foreground whitespace-pre-wrap break-words flex-1">
                              {message.content}
                            </div>
                            
                            {canDeleteMessage(message) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMessageMutation.mutate(message.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                disabled={deleteMessageMutation.isPending}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t p-4">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              placeholder={placeholder}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1"
              disabled={sendMessageMutation.isPending}
            />
            <Button 
              type="submit" 
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
              size="sm"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}