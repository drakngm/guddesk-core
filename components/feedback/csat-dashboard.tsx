"use client";

import type { CsatAnalytics } from "@/lib/surveys/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  data: CsatAnalytics;
  workspaceSlug: string;
}

const STAR_COLORS = ["", "text-red-500", "text-orange-500", "text-yellow-500", "text-lime-500", "text-green-500"];

export function CsatDashboard({ data, workspaceSlug }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Customer Satisfaction (CSAT)</h2>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.averageScore !== null ? (
                <>
                  {data.averageScore}
                  <span className="text-lg text-muted-foreground">/5</span>
                </>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Responses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.totalResponses}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Satisfaction Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {data.totalResponses > 0
                ? `${Math.round(
                    ((data.distribution.filter((d) => d.rating >= 4).reduce((s, d) => s + d.count, 0)) /
                      data.totalResponses) *
                      100,
                  )}%`
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">4-5 star responses</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rating Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.distribution.reverse().map(({ rating, count }) => {
              const percentage =
                data.totalResponses > 0
                  ? Math.round((count / data.totalResponses) * 100)
                  : 0;
              return (
                <div key={rating} className="flex items-center gap-3">
                  <span className="w-12 text-sm font-medium">
                    {rating} {"★".repeat(rating)}
                  </span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        rating >= 4
                          ? "bg-green-500"
                          : rating === 3
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-16 text-sm text-right text-muted-foreground">
                    {count} ({percentage}%)
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Per-Agent Breakdown */}
      {data.perAgent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-Agent Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.perAgent
                .sort((a, b) => b.avgScore - a.avgScore)
                .map((agent) => (
                  <div
                    key={agent.assigneeId}
                    className="flex items-center justify-between rounded border p-3"
                  >
                    <span className="font-medium">{agent.agentName}</span>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{agent.count} responses</Badge>
                      <span className={`font-bold ${agent.avgScore >= 4 ? "text-green-600" : agent.avgScore >= 3 ? "text-yellow-600" : "text-red-600"}`}>
                        {agent.avgScore}/5
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Responses */}
      {data.recentResponses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentResponses.slice(0, 10).map((response) => (
                <div key={response.id} className="flex items-start gap-3 border-b pb-3 last:border-0">
                  <span className={`text-lg font-bold ${STAR_COLORS[response.rating]}`}>
                    {response.rating}★
                  </span>
                  <div className="flex-1">
                    {response.comment && (
                      <p className="text-sm">{response.comment}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(response.respondedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.totalResponses === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No CSAT responses yet. Enable CSAT surveys in Settings → Surveys.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
