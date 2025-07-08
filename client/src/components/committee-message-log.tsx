import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import BaseChat from "./base-chat";

interface CommitteeMessageLogProps {
  committee: string;
}

export default function CommitteeMessageLog({ committee }: CommitteeMessageLogProps) {
  const { user } = useAuth();

  // Get or create committee conversation
  const { data: committeeConversation, isLoading } = useQuery({
    queryKey: ["/api/messaging/conversations/committee", committee],
    queryFn: async () => {
      // First try to find existing conversation
      const conversationsResponse = await apiRequest('GET', '/api/messaging/conversations');
      const conversations = await conversationsResponse.json();
      const conversationName = `${committee.charAt(0).toUpperCase() + committee.slice(1)} Committee`;
      const existingConversation = conversations.find((conv: any) => 
        conv.type === 'channel' && conv.name === conversationName
      );
      
      if (existingConversation) {
        return existingConversation;
      }
      
      // Create new conversation if not found
      const response = await apiRequest('POST', '/api/messaging/conversations', {
        type: 'channel',
        name: conversationName
      });
      return await response.json();
    },
    enabled: !!committee && !!user,
  });

  if (isLoading || !committeeConversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading {committee} committee chat...</p>
      </div>
    );
  }

  // Custom header icon
  const headerIcon = (
    <div className="flex items-center gap-2">
      <Users className="w-5 h-5 text-blue-500" />
      <span className="font-semibold">{committee.charAt(0).toUpperCase() + committee.slice(1)} Committee</span>
    </div>
  );

  return (
    <BaseChat
      conversationId={committeeConversation.id}
      conversationName={`${committee.charAt(0).toUpperCase() + committee.slice(1)} Committee`}
      placeholder={`Message ${committee} committee...`}
      headerIcon={headerIcon}
    />
  );
}