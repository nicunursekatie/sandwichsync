import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, User, Search, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BaseChat from "./base-chat";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Conversation {
  id: number;
  type: string;
  name: string;
  createdAt: string;
}

export default function DirectMessaging() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch all users for selection
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch user's conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/messaging/conversations"],
    enabled: !!user,
  });

  // Get or create conversation when user is selected
  useEffect(() => {
    const findOrCreateConversation = async () => {
      if (!selectedUser || !user) return;

      const userIds = [(user as any).id, selectedUser.id].sort();
      const conversationName = `${userIds[0]}_${userIds[1]}`;

      // Find existing conversation
      let conversation = conversations.find(c => 
        c.type === 'direct' && c.name === conversationName
      );

      if (conversation) {
        setCurrentConversation(conversation);
      } else {
        // Create new conversation
        try {
          const response = await apiRequest('POST', '/api/messaging/conversations', {
            type: "direct",
            name: conversationName,
            participants: [(user as any).id, selectedUser.id]
          });
          const newConversation = await response.json();
          setCurrentConversation(newConversation);
          queryClient.invalidateQueries({ queryKey: ["/api/messaging/conversations"] });
        } catch (error) {
          console.error('Failed to create conversation:', error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('401')) {
            toast({ title: "Authentication error - please refresh the page", variant: "destructive" });
          } else {
            toast({ title: "Failed to create conversation", variant: "destructive" });
          }
          return;
        }
      }
    };

    // Add a small delay to prevent rapid-fire requests
    const timeoutId = setTimeout(findOrCreateConversation, 100);
    return () => clearTimeout(timeoutId);
  }, [selectedUser, user, conversations, toast]);

  // Filter users based on search
  const filteredUsers = users.filter(u => 
    u.id !== (user as any)?.id && // Don't show current user
    (u.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     u.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // If on mobile and user is selected, show only the chat
  if (selectedUser && currentConversation) {
    // Custom header with back button and user info
    const headerIcon = (
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSelectedUser(null);
            setCurrentConversation(null);
          }}
          className="mr-2 p-1 lg:hidden"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Avatar className="w-8 h-8 mr-3">
          <AvatarFallback className="bg-teal-100 text-teal-700">
            {selectedUser.firstName?.[0]}{selectedUser.lastName?.[0]}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="font-medium">{selectedUser.firstName} {selectedUser.lastName}</div>
          <div className="text-xs text-slate-500">{selectedUser.email}</div>
        </div>
      </div>
    );

    return (
      <div className="h-full max-h-screen flex">
        {/* User List - Hidden on mobile when chat is active */}
        <div className="hidden lg:flex lg:flex-col w-1/3 border-r bg-gray-50 dark:bg-gray-900 h-full overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex-shrink-0">
            <h2 className="font-sub-heading text-lg mb-3">Direct Messages</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <User className="w-12 h-12 mx-auto mb-2" />
                  <p>No users found</p>
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={`flex items-center p-3 rounded-lg cursor-pointer hover:bg-slate-100 ${
                      selectedUser?.id === u.id ? 'bg-teal-50 border border-teal-200' : ''
                    }`}
                  >
                    <Avatar className="w-10 h-10 mr-3">
                      <AvatarFallback className="bg-teal-100 text-teal-700">
                        {u.firstName?.[0]}{u.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {u.role}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="flex-1">
          <BaseChat
            conversationId={currentConversation.id}
            conversationName={`${selectedUser.firstName} ${selectedUser.lastName}`}
            placeholder={`Message ${selectedUser.firstName}...`}
            headerIcon={headerIcon}
          />
        </div>
      </div>
    );
  }

  // User selection view (mobile) or empty state (desktop)
  return (
    <div className="h-full max-h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* User Selection */}
      <div className="w-full lg:w-1/3 lg:border-r bg-gray-50 dark:bg-gray-900 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="font-sub-heading text-lg mb-3">Direct Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <User className="w-12 h-12 mx-auto mb-2" />
                <p>No users found</p>
              </div>
            ) : (
              filteredUsers.map((u) => (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="flex items-center p-3 rounded-lg cursor-pointer hover:bg-slate-100"
                >
                  <Avatar className="w-10 h-10 mr-3">
                    <AvatarFallback className="bg-teal-100 text-teal-700">
                      {u.firstName?.[0]}{u.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{u.email}</p>
                    <Badge variant="secondary" className="text-xs mt-1">
                      {u.role}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Empty State - Desktop Only */}
      <div className="hidden lg:flex flex-1 items-center justify-center">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">Select a user to start messaging</h3>
          <p className="text-slate-500">Choose someone from the list to begin a direct conversation</p>
        </div>
      </div>
    </div>
  );
}