import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import BaseChat from "./base-chat";

const committees = [
  { 
    id: "marketing_committee", 
    name: "Marketing Committee", 
    description: "Marketing campaigns and promotions"
  },
  { 
    id: "grant_committee", 
    name: "Grant Committee", 
    description: "Grant applications and funding"
  },
  { 
    id: "group_events", 
    name: "Group Events", 
    description: "Team events and activities"
  },
  { 
    id: "finance_committee", 
    name: "Finance Committee", 
    description: "Budget and financial planning"
  },
  { 
    id: "operations", 
    name: "Operations", 
    description: "Daily operations and logistics"
  }
];

export default function CommitteeChat() {
  const { user } = useAuth();
  const [selectedCommittee, setSelectedCommittee] = useState<any>(null);

  // Get or create committee conversation
  const { data: committeeConversation } = useQuery({
    queryKey: ["/api/messaging/conversations/committee", selectedCommittee?.id],
    queryFn: async () => {
      if (!selectedCommittee) return null;
      
      // First try to find existing committee conversation
      const conversationsResponse = await apiRequest('GET', '/api/messaging/conversations');
      const conversations = await conversationsResponse.json();
      const existingConversation = conversations.find((conv: any) => 
        conv.name === selectedCommittee.name
      );

      if (existingConversation) {
        return existingConversation;
      }

      // Create new committee conversation if not found
      const response = await apiRequest('POST', '/api/messaging/conversations', {
        type: 'channel',
        name: selectedCommittee.name
      });
      return await response.json();
    },
    enabled: !!selectedCommittee,
  });

  // Committee selection mode
  if (!selectedCommittee) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <Users className="w-6 h-6 mr-2" />
          Committee Chat
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {committees.map((committee) => (
            <div
              key={committee.id}
              onClick={() => setSelectedCommittee(committee)}
              className="p-6 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
            >
              <div className="flex items-center mb-3">
                <Users className="w-8 h-8 text-blue-500 mr-3" />
                <div>
                  <h3 className="font-semibold">{committee.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{committee.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Chat mode - use BaseChat
  if (!committeeConversation) {
    return <div className="p-6 text-center text-muted-foreground">Loading conversation...</div>;
  }

  // Custom header with back button
  const headerIcon = (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSelectedCommittee(null)}
        className="mr-3 p-1"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <Users className="w-6 h-6 text-blue-500 mr-2" />
      <div>
        <h3 className="font-semibold">{selectedCommittee.name}</h3>
        <p className="text-xs text-gray-600">Committee Chat</p>
      </div>
    </div>
  );

  return (
    <BaseChat
      conversationId={committeeConversation.id}
      conversationName={selectedCommittee.name}
      placeholder={`Message ${selectedCommittee.name}...`}
      headerIcon={headerIcon}
      className="h-[600px]"
    />
  );
}