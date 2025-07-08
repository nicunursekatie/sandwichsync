import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Users } from "lucide-react";
import CommitteeMessageLog from "@/components/committee-message-log";
import { useAuth } from "@/hooks/useAuth";
import { hasPermission, USER_ROLES } from "@/lib/authUtils";
import { PERMISSIONS } from "@/lib/authUtils";

const committees = [
  { 
    id: "marketing_committee", 
    name: "Marketing Committee", 
    description: "Social media, outreach, and community engagement",
    color: "bg-blue-100 text-blue-800"
  },
  { 
    id: "operations_committee", 
    name: "Operations Committee", 
    description: "Logistics, scheduling, and day-to-day operations",
    color: "bg-green-100 text-green-800"
  },
  { 
    id: "finance_committee", 
    name: "Finance Committee", 
    description: "Budget management and financial planning",
    color: "bg-purple-100 text-purple-800"
  },
  { 
    id: "development_committee", 
    name: "Development Committee", 
    description: "Fundraising and resource development",
    color: "bg-orange-100 text-orange-800"
  },
  { 
    id: "volunteer_committee", 
    name: "Volunteer Committee", 
    description: "Volunteer coordination and engagement",
    color: "bg-pink-100 text-pink-800"
  },
  { 
    id: "special_events_committee", 
    name: "Special Events Committee", 
    description: "Event planning and coordination",
    color: "bg-yellow-100 text-yellow-800"
  }
];

export default function CommitteeMessaging() {
  const { user } = useAuth();
  const [selectedCommittee, setSelectedCommittee] = useState<string | null>(null);

  // Filter committees based on user permissions
  const availableCommittees = committees.filter(committee => {
    if (hasPermission(user, PERMISSIONS.COMMITTEE_CHAT)) {
      return true;
    }
    return false;
  });

  if (selectedCommittee) {
    const committee = committees.find(c => c.id === selectedCommittee);
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-2 p-4 border-b">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCommittee(null)}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Committees
          </Button>
          <Badge className={committee?.color || "bg-gray-100 text-gray-800"}>
            {committee?.name}
          </Badge>
        </div>
        <div className="flex-1 overflow-hidden">
          <CommitteeMessageLog committee={selectedCommittee} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Committee Messaging</h2>
        </div>
        <p className="text-gray-600">
          Select a committee to join the conversation
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {availableCommittees.map((committee) => (
          <Card 
            key={committee.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedCommittee(committee.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{committee.name}</CardTitle>
                <Badge className={committee.color}>
                  Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                {committee.description}
              </p>
              <Button variant="outline" className="w-full">
                Join Conversation
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {availableCommittees.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            You don't have permission to access committee messaging.
          </p>
        </div>
      )}
    </div>
  );
}
