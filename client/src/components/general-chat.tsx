import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Hash, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import BaseChat from "./base-chat";

interface Conversation {
  id: number;
  name: string;
  type: string;
  createdAt: string;
}

export default function GeneralChat() {
  const { user } = useAuth();

  // Get or create the general conversation
  const { data: generalConversation, isLoading: conversationLoading } = useQuery({
    queryKey: ["/api/messaging/conversations/general"],
    queryFn: async () => {
      // First try to find existing general conversation
      const conversationsResponse = await apiRequest('GET', '/api/messaging/conversations');
      const conversations = await conversationsResponse.json() as Conversation[];
      const existingConversation = conversations.find((conv: Conversation) => 
        conv.name === "General Chat"
      );

      if (existingConversation) {
        return existingConversation;
      }

      // Create new general conversation if not found
      const response = await apiRequest('POST', '/api/messaging/conversations', {
        name: "General Chat",
        type: "channel"
      });
      return await response.json() as Conversation;
    },
    enabled: !!user
  });

  if (conversationLoading || !generalConversation) {
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
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            Setting up General Chat...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <BaseChat
      conversationId={generalConversation.id}
      conversationName="General Chat"
      placeholder="Message everyone..."
      headerIcon={<Hash className="w-5 h-5" />}
    />
  );
}
