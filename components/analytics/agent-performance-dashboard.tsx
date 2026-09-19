"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AgentPerformanceData } from "@/lib/agent-analytics";

interface Props {
  data: AgentPerformanceData;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function AgentPerformanceDashboard({ data }: Props) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.totals.conversationsHandled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.totals.messagesCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg First Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatDuration(data.totals.avgFirstResponseMs)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Resolution Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatDuration(data.totals.avgResolutionMs)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {data.members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No agent data available yet. Performance snapshots are generated daily.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Conversations</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    Avg Response
                  </TableHead>
                  <TableHead className="hidden text-right sm:table-cell">
                    Avg Resolution
                  </TableHead>
                  <TableHead className="text-right">CSAT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.members.map((agent) => {
                  const initials = agent.name.slice(0, 2).toUpperCase();
                  return (
                    <TableRow key={agent.memberId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7">
                            {agent.image && <AvatarImage src={agent.image} />}
                            <AvatarFallback className="text-[10px]">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{agent.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {agent.conversationsHandled}
                      </TableCell>
                      <TableCell className="text-right">{agent.messagesCount}</TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        {formatDuration(agent.avgFirstResponseMs)}
                      </TableCell>
                      <TableCell className="hidden text-right sm:table-cell">
                        {formatDuration(agent.avgResolutionMs)}
                      </TableCell>
                      <TableCell className="text-right">
                        {agent.csatAverage !== null ? (
                          <span>
                            {agent.csatAverage.toFixed(1)}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({agent.csatCount})
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
