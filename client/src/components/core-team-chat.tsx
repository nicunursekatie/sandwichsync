import { useQuery } from "@tanstack/react-query";
import { Crown, Shield, AlertTriangle, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
import BaseChat from "./base-chat";

export default function CoreTeamChat() {
  const { user } = useAuth();
  
  // Only allow users with core team chat access
  const hasCoreTeamAccess = hasPermission(user, 'core_team_chat');
  
  if (!hasCoreTeamAccess) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center text-red-600">
            <Shield className="w-5 h-5 mr-2" />
            Core Team Chat - Access Restricted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <p className="text-slate-600">This chat is restricted to core team administrators only.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Get or create Core Team conversation
  const { data: coreTeamConversation, isLoading } = useQuery({
    queryKey: ["/api/messaging/conversations/core-team"],
    queryFn: async () => {
      // First try to find existing core team conversation
      const conversationsResponse = await apiRequest('GET', '/api/messaging/conversations');
      const conversations = await conversationsResponse.json();
      const existingConversation = conversations.find((conv: any) => 
        conv.name === "Core Team Chat"
      );

      if (existingConversation) {
        return existingConversation;
      }

      // Create new core team conversation if not found
      const response = await apiRequest('POST', '/api/messaging/conversations', {
        type: 'channel',
        name: 'Core Team Chat'
      });
      return await response.json();
    },
    enabled: hasCoreTeamAccess,
  });

  if (isLoading || !coreTeamConversation) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading core team chat...</p>
      </div>
    );
  }

  // Custom header with admin styling
  const headerIcon = (
    <div className="flex items-center">
      <Crown className="w-5 h-5 mr-2 text-orange-600" />
      <span className="font-semibold">Core Team Chat</span>
      <Badge variant="destructive" className="ml-2 text-xs">
        <Shield className="w-3 h-3 mr-1" />
        Admin Only
      </Badge>
    </div>
  );

  // Header actions showing admin info
  const headerActions = (
    <p className="text-xs text-slate-600 flex items-center">
      <Users className="w-3 h-3 mr-1" />
      Secure channel for administrators
    </p>
  );

  return (
    <div className="h-full bg-gradient-to-b from-orange-50/50 to-transparent">
      <BaseChat
        conversationId={coreTeamConversation.id}
        conversationName="Core Team Chat"
        placeholder="Send a secure message to the core team..."
        headerIcon={headerIcon}
        headerActions={headerActions}
      />
    </div>
  );
}