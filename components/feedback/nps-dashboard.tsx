"use client";

import type { NpsAnalytics } from "@/lib/surveys/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  data: NpsAnalytics;
}

export function NpsDashboard({ data }: Props) {
  const total = data.totalResponses;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Net Promoter Score (NPS)</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>NPS Score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${
              data.npsScore === null
                ? "text-muted-foreground"
                : data.npsScore >= 50
                  ? "text-green-600"
                  : data.npsScore >= 0
                    ? "text-yellow-600"
                    : "text-red-600"
            }`}>
              {data.npsScore !== null ? data.npsScore : "—"}
            </div>
            <p className="text-xs text-muted-foreground">Range: -100 to 100</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Promoters (9-10)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {data.promoters}
            </div>
            <p className="text-xs text-muted-foreground">
              {total > 0 ? `${Math.round((data.promoters / total) * 100)}%` : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Passives (7-8)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {data.passives}
            </div>
            <p className="text-xs text-muted-foreground">
              {total > 0 ? `${Math.round((data.passives / total) * 100)}%` : "0%"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Detractors (0-6)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {data.detractors}
            </div>
            <p className="text-xs text-muted-foreground">
              {total > 0 ? `${Math.round((data.detractors / total) * 100)}%` : "0%"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Visual breakdown bar */}
      {total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-8 rounded-full overflow-hidden">
              {data.promoters > 0 && (
                <div
                  className="bg-green-500 flex items-center justify-center text-xs font-medium text-white"
                  style={{ width: `${(data.promoters / total) * 100}%` }}
                >
                  {Math.round((data.promoters / total) * 100)}%
                </div>
              )}
              {data.passives > 0 && (
                <div
                  className="bg-yellow-400 flex items-center justify-center text-xs font-medium text-white"
                  style={{ width: `${(data.passives / total) * 100}%` }}
                >
                  {Math.round((data.passives / total) * 100)}%
                </div>
              )}
              {data.detractors > 0 && (
                <div
                  className="bg-red-500 flex items-center justify-center text-xs font-medium text-white"
                  style={{ width: `${(data.detractors / total) * 100}%` }}
                >
                  {Math.round((data.detractors / total) * 100)}%
                </div>
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Promoters</span>
              <span>Passives</span>
              <span>Detractors</span>
            </div>
          </CardContent>
        </Card>
      )}

      {total === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No NPS responses yet. Enable NPS surveys in Settings → Surveys.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
