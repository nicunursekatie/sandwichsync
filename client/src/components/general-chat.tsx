import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, Hash } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Message {
  id: number;
  content: string;
  senderId: string;
  conversationId: number;
  createdAt: string;
  sender?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Conversation {
  id: number;
  name: string;
  type: string;
  createdAt: string;
}

export default function GeneralChat() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState("");

  // Get or create the general conversation
  const { data: generalConversation, isLoading: conversationLoading } = useQuery({
    queryKey: ["/api/conversations/general"],
    queryFn: async () => {
      // First try to find existing general conversation
      const conversationsResponse = await apiRequest('GET', '/api/conversations');
      const conversations = await conversationsResponse.json() as Conversation[];
      console.log("Found conversations:", conversations);
      const existingConversation = conversations.find((conv: Conversation) => 
        conv.name === "General Chat" && conv.type === "general"
      );

      if (existingConversation) {
        console.log("Found existing general conversation:", existingConversation);
        return existingConversation;
      }

      // Create new general conversation if not found
      console.log("Creating new general conversation");
      const response = await apiRequest('POST', '/api/conversations', {
        name: "General Chat",
        type: "general",
        participantIds: [(user as any)?.id] // Start with current user, others will join automatically
      });
      return await response.json() as Conversation;
    },
    enabled: !!user
  });

  // Fetch messages for the general conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/conversations", generalConversation?.id, "messages"],
    queryFn: async () => {
      if (!generalConversation) return [];
      const response = await apiRequest('GET', `/api/conversations/${generalConversation.id}/messages`);
      return await response.json() as Message[];
    },
    enabled: !!generalConversation,
    refetchInterval: 5000 // Refresh every 5 seconds for real-time feel
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (messageContent: string) => {
      if (!generalConversation) throw new Error("No conversation available");
      const response = await apiRequest('POST', `/api/conversations/${generalConversation.id}/messages`, {
        content: messageContent
      });
      return await response.json();
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ 
        queryKey: ["/api/conversations", generalConversation?.id, "messages"] 
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    sendMessageMutation.mutate(newMessage);
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

  if (conversationLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            General Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            Setting up General Chat...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          General Chat
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Open discussion for all team members
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messagesLoading ? (
              <div className="text-center text-muted-foreground py-8">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">No messages yet</p>
                <p className="text-sm">Start the conversation!</p>
              </div>
            ) : (
              <>
                {messages.map((message: Message, index: number) => {
                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const showDate = !prevMessage || 
                    formatDate(message.createdAt) !== formatDate(prevMessage.createdAt);
                  const showAvatar = !prevMessage || 
                    prevMessage.senderId !== message.senderId ||
                    showDate;

                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="bg-muted px-3 py-1 rounded-full text-xs font-medium text-muted-foreground">
                            {formatDate(message.createdAt)}
                          </span>
                        </div>
                      )}
                      
                      <div className={`flex gap-3 ${showAvatar ? 'mt-4' : 'mt-1'}`}>
                        <div className="w-8 h-8 flex-shrink-0">
                          {showAvatar && (
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">
                                {message.sender ? 
                                  `${message.sender.firstName?.[0] || ''}${message.sender.lastName?.[0] || ''}` :
                                  'U'
                                }
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          {showAvatar && (
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="font-medium text-sm">
                                {message.sender ? 
                                  `${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() ||
                                  message.sender.email :
                                  'Unknown User'
                                }
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatTime(message.createdAt)}
                              </span>
                            </div>
                          )}
                          
                          <div className="text-sm text-foreground whitespace-pre-wrap break-words">
                            {message.content}
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
            <Textarea
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              className="min-h-[40px] max-h-32 resize-none flex-1"
              rows={1}
            />
            <Button 
              type="submit" 
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
              size="sm"
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
