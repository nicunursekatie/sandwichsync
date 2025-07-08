import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Building2, Crown, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import BaseChat from "./base-chat";
import type { Host } from "@shared/schema";

interface HostWithContacts extends Host {
  contacts: any[];
}

export default function HostChat() {
  const { user } = useAuth();
  const [selectedHost, setSelectedHost] = useState<Host | null>(null);

  const { data: hosts = [], isLoading: hostsLoading, error: hostsError } = useQuery<HostWithContacts[]>({
    queryKey: ['/api/hosts-with-contacts'],
  });

  // Get or create host conversation
  const { data: hostConversation } = useQuery({
    queryKey: ["/api/messaging/conversations/host", selectedHost?.id],
    queryFn: async () => {
      if (!selectedHost) return null;
      
      // First try to find existing host conversation
      const conversationsResponse = await apiRequest('GET', '/api/messaging/conversations');
      const conversations = await conversationsResponse.json();
      const existingConversation = conversations.find((conv: any) => 
        conv.name === `${selectedHost.name} Host Chat`
      );

      if (existingConversation) {
        return existingConversation;
      }

      // Create new host conversation if not found
      const response = await apiRequest('POST', '/api/messaging/conversations', {
        type: 'channel',
        name: `${selectedHost.name} Host Chat`
      });
      return await response.json();
    },
    enabled: !!selectedHost,
  });

  // Host selection mode
  if (!selectedHost) {
    // Handle loading state
    if (hostsLoading) {
      return (
        <div className="p-6 text-center">
          <div className="text-muted-foreground">Loading hosts...</div>
        </div>
      );
    }

    // Handle error state
    if (hostsError) {
      return (
        <div className="p-6 text-center">
          <div className="text-red-600">
            Error loading hosts: {hostsError instanceof Error ? hostsError.message : 'Unknown error'}
          </div>
        </div>
      );
    }

    // Handle empty state
    if (hosts.length === 0) {
      return (
        <div className="p-6 text-center">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Hosts Available</h3>
          <p className="text-muted-foreground">There are no hosts to communicate with at this time.</p>
        </div>
      );
    }

    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          <MessageCircle className="w-6 h-6 mr-2" />
          Host Communication Hub
        </h2>
        
        <div className="grid gap-4">
          {hosts.map((host) => (
            <Card 
              key={host.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedHost(host)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="text-white" style={{backgroundColor: 'var(--tsp-teal)'}}>
                        {host.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold flex items-center">
                        {host.name}
                        {host.status === 'lead' && (
                          <Crown className="w-4 h-4 ml-2 text-amber-500" />
                        )}
                      </h3>
                      <p className="text-sm text-gray-600">{host.address || 'No address'}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={host.status === 'active' ? 'default' : 'secondary'}>
                      {host.status}
                    </Badge>
                    <Building2 className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Chat mode - use BaseChat
  if (!hostConversation) {
    return <div className="p-6 text-center text-muted-foreground">Loading conversation...</div>;
  }

  // Custom header with back button
  const headerIcon = (
    <div className="flex items-center space-x-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setSelectedHost(null)}
        className="p-1"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <Avatar className="w-8 h-8">
        <AvatarFallback className="text-white text-sm" style={{backgroundColor: 'var(--tsp-teal)'}}>
          {selectedHost.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <div>
        <h3 className="font-semibold flex items-center">
          {selectedHost.name}
          {selectedHost.status === 'lead' && (
            <Crown className="w-4 h-4 ml-2 text-amber-500" />
          )}
        </h3>
        <p className="text-xs text-gray-600">Host Chat</p>
      </div>
    </div>
  );

  return (
    <BaseChat
      conversationId={hostConversation.id}
      conversationName={`${selectedHost.name} Host Chat`}
      placeholder={`Message ${selectedHost.name}...`}
      headerIcon={headerIcon}
    />
  );
}