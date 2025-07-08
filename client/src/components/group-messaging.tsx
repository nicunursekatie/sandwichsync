import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Plus, Users, Crown, Trash2, UserPlus, Archive, LogOut, VolumeX, Eye, X, ChevronLeft } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import BaseChat from "./base-chat";
import type { MessageGroup, InsertMessageGroup, User } from "@shared/schema";

interface GroupWithMembers extends MessageGroup {
  memberCount: number;
  userRole: string;
  members?: Array<{
    userId: string;
    role: string;
    firstName: string;
    lastName: string;
    email: string;
  }>;
}

interface GroupMessagesProps {
  currentUser: any;
}

export function GroupMessaging({ currentUser }: GroupMessagesProps) {
  const [selectedGroup, setSelectedGroup] = useState<GroupWithMembers | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showMemberDialog, setShowMemberDialog] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    memberIds: [] as string[]
  });
  const [addMemberForm, setAddMemberForm] = useState({
    memberIds: [] as string[]
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's message groups
  const { data: groups = [], isLoading: groupsLoading } = useQuery<GroupWithMembers[]>({
    queryKey: ["/api/message-groups"],
  });

  // Fetch all users for member selection
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Fetch group members when a group is selected
  const { data: groupMembers = [] } = useQuery<Array<{
    userId: string;
    role: string;
    firstName: string;
    lastName: string;
    email: string;
  }>>({
    queryKey: ["/api/message-groups", selectedGroup?.id, "members"],
    queryFn: async () => {
      if (!selectedGroup) return [];
      const response = await fetch(`/api/message-groups/${selectedGroup.id}/members`, {
        credentials: 'include'
      });
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Not authorized to view members in this group");
        }
        throw new Error("Failed to fetch group members");
      }
      return response.json();
    },
    enabled: !!selectedGroup,
  });

  // Get or create group conversation
  const { data: groupConversation } = useQuery({
    queryKey: ["/api/messaging/conversations/group", selectedGroup?.id],
    queryFn: async () => {
      if (!selectedGroup) return null;
      
      // First try to find existing group conversation
      const conversationsResponse = await apiRequest('GET', '/api/messaging/conversations');
      const conversations = await conversationsResponse.json();
      const existingConversation = conversations.find((conv: any) => 
        conv.type === 'group' && conv.name === selectedGroup.name
      );

      if (existingConversation) {
        return existingConversation;
      }

      // Create new group conversation if not found
      const response = await apiRequest('POST', '/api/messaging/conversations', {
        type: 'group',
        name: selectedGroup.name
      });
      return await response.json();
    },
    enabled: !!selectedGroup,
  });

  // Create new group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (data: InsertMessageGroup & { memberIds: string[] }) => {
      const response = await fetch("/api/message-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create group: ${error}`);
      }
      return response.json();
    },
    onSuccess: (newGroup) => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      setGroupForm({ name: "", description: "", memberIds: [] });
      setShowCreateDialog(false);
      setSelectedGroup(newGroup);
      toast({ title: "Group created successfully!" });
    },
    onError: (error) => {
      console.error("Group creation error:", error);
      toast({ 
        title: "Failed to create group", 
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive" 
      });
    },
  });

  // Add members to group mutation
  const addMembersMutation = useMutation({
    mutationFn: async (data: { groupId: number; memberIds: string[] }) => {
      const response = await fetch(`/api/message-groups/${data.groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ memberIds: data.memberIds }),
      });
      if (!response.ok) throw new Error("Failed to add members");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups", selectedGroup?.id, "members"] });
      setAddMemberForm({ memberIds: [] });
      setShowAddMemberDialog(false);
      toast({ title: "Members added successfully!" });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId }: { groupId: number; userId: string }) => {
      const response = await fetch(`/api/message-groups/${groupId}/members/${userId}`, {
        method: "DELETE",
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to remove member");
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups", selectedGroup?.id, "members"] });
      
      if (variables.userId === currentUser?.id) {
        setSelectedGroup(null);
        toast({ title: "You have left the group successfully!" });
      } else {
        toast({ title: "Member removed successfully!" });
      }
    },
  });

  // Promote member to admin mutation
  const promoteMemberMutation = useMutation({
    mutationFn: async ({ groupId, userId, role }: { groupId: number; userId: string; role: 'admin' | 'member' }) => {
      const response = await fetch(`/api/message-groups/${groupId}/members/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error("Failed to update member role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups", selectedGroup?.id, "members"] });
      toast({ title: "Member role updated successfully!" });
    },
  });

  // Delete entire group mutation (super admin only)
  const deleteGroupMutation = useMutation({
    mutationFn: async (groupId: number) => {
      const response = await fetch(`/api/message-groups/${groupId}`, {
        method: "DELETE",
        credentials: 'include',
      });
      if (!response.ok) throw new Error("Failed to delete group");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/message-groups"] });
      setSelectedGroup(null);
      toast({ title: "Group deleted successfully!", description: "The entire group and all messages have been permanently removed." });
    },
    onError: () => {
      toast({ title: "Failed to delete group", variant: "destructive" });
    },
  });

  const handleCreateGroup = () => {
    if (!groupForm.name.trim()) {
      toast({ title: "Group name is required", variant: "destructive" });
      return;
    }
    createGroupMutation.mutate({
      ...groupForm,
      createdBy: currentUser?.id || "",
    });
  };

  const handleAddMembers = () => {
    if (!selectedGroup || addMemberForm.memberIds.length === 0) {
      toast({ title: "Please select members to add", variant: "destructive" });
      return;
    }
    addMembersMutation.mutate({
      groupId: selectedGroup.id,
      memberIds: addMemberForm.memberIds,
    });
  };

  const formatDisplayName = (user: User) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email.split('@')[0];
  };

  // Different tabs for group categories
  const activeGroups = groups.filter(g => g.userRole !== 'archived' && g.userRole !== 'left');
  const archivedGroups = groups.filter(g => g.userRole === 'archived');
  const leftGroups = groups.filter(g => g.userRole === 'left');

  // If a group is selected and we have a conversation, show the chat
  if (selectedGroup && groupConversation) {
    // Custom header with group info and actions
    const headerIcon = (
      <div className="flex items-center flex-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedGroup(null)}
          className="mr-2 p-1 lg:hidden"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Avatar className="h-8 w-8 mr-3">
          <AvatarFallback>
            {selectedGroup.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            {selectedGroup.name}
            {selectedGroup.userRole === 'admin' && (
              <Badge variant="secondary" className="text-xs">
                <Crown className="h-3 w-3 mr-1" />
                Admin
              </Badge>
            )}
          </h3>
          <button
            onClick={() => setShowMemberDialog(true)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Users className="h-3 w-3" />
            {selectedGroup.memberCount} members
          </button>
        </div>
      </div>
    );

    const headerActions = (
      <div className="flex items-center gap-2">
        {(currentUser?.role === 'super_admin' || selectedGroup.userRole === 'admin') && (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setShowAddMemberDialog(true)}
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">•••</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => removeMemberMutation.mutate({ 
                groupId: selectedGroup.id, 
                userId: currentUser?.id 
              })}
              className="text-red-600"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Leave Group
            </DropdownMenuItem>
            {currentUser?.role === 'super_admin' && (
              <DropdownMenuItem 
                onClick={() => {
                  if (confirm(`Delete entire group "${selectedGroup.name}"? This cannot be undone.`)) {
                    deleteGroupMutation.mutate(selectedGroup.id);
                  }
                }}
                className="text-red-700 font-semibold"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Group
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );

    return (
      <>
        <div className="h-full max-h-screen flex">
          {/* Group List - Hidden on mobile when chat is active */}
          <div className="hidden lg:block w-1/3 border-r bg-gray-50 dark:bg-gray-900">
            <GroupsList 
              groups={groups}
              selectedGroup={selectedGroup}
              onSelectGroup={setSelectedGroup}
              onCreateGroup={() => setShowCreateDialog(true)}
              currentUser={currentUser}
            />
          </div>

          {/* Chat Area */}
          <div className="flex-1">
            <BaseChat
              conversationId={groupConversation.id}
              conversationName={selectedGroup.name}
              placeholder={`Message ${selectedGroup.name}...`}
              headerIcon={headerIcon}
              headerActions={headerActions}
            />
          </div>
        </div>

        {/* Member Management Dialog */}
        <Dialog open={showMemberDialog} onOpenChange={setShowMemberDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedGroup.name} Members</DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-96">
              <div className="space-y-2">
                {groupMembers.map((member) => (
                  <div key={member.userId} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {member.firstName?.[0]}{member.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      {member.role === 'admin' && (
                        <Badge variant="secondary" className="text-xs">
                          <Crown className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    {(currentUser?.role === 'super_admin' || selectedGroup.userRole === 'admin') && member.userId !== currentUser?.id && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => promoteMemberMutation.mutate({
                            groupId: selectedGroup.id,
                            userId: member.userId,
                            role: member.role === 'admin' ? 'member' : 'admin'
                          })}
                        >
                          {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeMemberMutation.mutate({
                            groupId: selectedGroup.id,
                            userId: member.userId
                          })}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Add Members Dialog */}
        <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Members to {selectedGroup.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Select Members to Add</label>
                <Select onValueChange={(userId) => {
                  const existingMemberIds = groupMembers.map(m => m.userId);
                  if (!addMemberForm.memberIds.includes(userId) && !existingMemberIds.includes(userId)) {
                    setAddMemberForm(prev => ({ 
                      memberIds: [...prev.memberIds, userId] 
                    }));
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select users to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {allUsers
                      .filter(user => {
                        const existingMemberIds = groupMembers.map(m => m.userId);
                        return user.id !== currentUser?.id && 
                               !addMemberForm.memberIds.includes(user.id) &&
                               !existingMemberIds.includes(user.id);
                      })
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {formatDisplayName(user)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {addMemberForm.memberIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {addMemberForm.memberIds.map((userId) => {
                      const user = allUsers.find(u => u.id === userId);
                      return (
                        <Badge key={userId} variant="secondary" className="text-xs">
                          {user ? formatDisplayName(user) : userId}
                          <button
                            onClick={() => setAddMemberForm(prev => ({
                              memberIds: prev.memberIds.filter(id => id !== userId)
                            }))}
                            className="ml-1 text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
              <Button 
                onClick={handleAddMembers}
                disabled={addMembersMutation.isPending || addMemberForm.memberIds.length === 0}
              >
                Add Members
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Group selection view
  return (
    <div className="h-full">
      <GroupsList 
        groups={groups}
        selectedGroup={selectedGroup}
        onSelectGroup={setSelectedGroup}
        onCreateGroup={() => setShowCreateDialog(true)}
        currentUser={currentUser}
      />

      {/* Create Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>
              Create a private group for focused discussions with selected team members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Group Name</label>
              <Input
                placeholder="e.g., Project Alpha Team"
                value={groupForm.name}
                onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                placeholder="What's this group about?"
                value={groupForm.description}
                onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Add Members</label>
              <Select onValueChange={(userId) => {
                if (!groupForm.memberIds.includes(userId)) {
                  setGroupForm(prev => ({ ...prev, memberIds: [...prev.memberIds, userId] }));
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team members" />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter(user => user.id !== currentUser?.id && !groupForm.memberIds.includes(user.id))
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {formatDisplayName(user)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {groupForm.memberIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {groupForm.memberIds.map((userId) => {
                    const user = allUsers.find(u => u.id === userId);
                    return (
                      <Badge key={userId} variant="secondary" className="text-xs">
                        {user ? formatDisplayName(user) : userId}
                        <button
                          onClick={() => setGroupForm(prev => ({
                            ...prev,
                            memberIds: prev.memberIds.filter(id => id !== userId)
                          }))}
                          className="ml-1 text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
            <Button 
              onClick={handleCreateGroup}
              disabled={createGroupMutation.isPending || !groupForm.name.trim()}
            >
              Create Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Separate component for groups list to avoid duplication
function GroupsList({ groups, selectedGroup, onSelectGroup, onCreateGroup, currentUser }: {
  groups: GroupWithMembers[];
  selectedGroup: GroupWithMembers | null;
  onSelectGroup: (group: GroupWithMembers | null) => void;
  onCreateGroup: () => void;
  currentUser: any;
}) {
  const activeGroups = groups.filter(g => g.userRole !== 'archived' && g.userRole !== 'left');
  const archivedGroups = groups.filter(g => g.userRole === 'archived');

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Groups</h2>
          <Button
            size="sm"
            onClick={onCreateGroup}
          >
            <Plus className="h-4 w-4 mr-1" />
            Create Group
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active" className="flex-1 flex flex-col">
        <TabsList className="mx-4">
          <TabsTrigger value="active">Active ({activeGroups.length})</TabsTrigger>
          <TabsTrigger value="archived">Archived ({archivedGroups.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {activeGroups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No active groups</p>
                  <p className="text-xs">Create a group to start collaborating</p>
                </div>
              ) : (
                activeGroups.map((group) => (
                  <Card
                    key={group.id}
                    className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      selectedGroup?.id === group.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => onSelectGroup(group)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {group.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h4 className="font-medium flex items-center gap-2">
                              {group.name}
                              {group.userRole === 'admin' && (
                                <Crown className="h-3 w-3 text-amber-500" />
                              )}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {group.memberCount} members
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="archived" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-2">
              {archivedGroups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Archive className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">No archived groups</p>
                </div>
              ) : (
                archivedGroups.map((group) => (
                  <Card
                    key={group.id}
                    className="cursor-pointer opacity-60"
                    onClick={() => onSelectGroup(group)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {group.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h4 className="font-medium">{group.name}</h4>
                          <p className="text-xs text-muted-foreground">Archived</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}