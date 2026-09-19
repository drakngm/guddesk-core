"use client";

import { format, parseISO } from "date-fns";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AiUsageChartProps {
  data: Array<Record<string, any>>;
}

const FEATURE_COLORS: Record<string, string> = {
  reply_suggestion: "hsl(var(--primary))",
  summarize: "hsl(var(--chart-2))",
  categorize: "hsl(var(--chart-3))",
  suggest_articles: "hsl(var(--chart-4))",
  sentiment: "hsl(var(--chart-5))",
};

const FEATURE_LABELS: Record<string, string> = {
  reply_suggestion: "Reply Suggestion",
  summarize: "Summarize",
  categorize: "Categorize",
  suggest_articles: "Suggest Articles",
  sentiment: "Sentiment",
};

export function AiUsageChart({ data }: AiUsageChartProps) {
  // Determine which features exist in the data
  const features = new Set<string>();
  for (const d of data) {
    for (const key of Object.keys(d)) {
      if (key !== "date") features.add(key);
    }
  }

  const chartData = data.map((d) => ({
    ...d,
    label: d.date ? format(parseISO(d.date), "MMM d") : "",
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Token Usage</CardTitle>
        <CardDescription>
          Tokens consumed by AI features across all workspaces
        </CardDescription>
      </CardHeader>
      <CardContent>
        {features.size === 0 ? (
          <p className="text-sm text-muted-foreground">No AI usage data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  fontSize: 12,
                }}
              />
              {Array.from(features).map((feature) => (
                <Bar
                  key={feature}
                  dataKey={feature}
                  name={FEATURE_LABELS[feature] ?? feature}
                  fill={FEATURE_COLORS[feature] ?? "hsl(var(--muted-foreground))"}
                  stackId="ai"
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
