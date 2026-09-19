"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SurveyConfig } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { upsertSurveyConfig } from "@/actions/manage-survey-config";

interface Props {
  csatConfig: SurveyConfig | null;
  npsConfig: SurveyConfig | null;
  workspaceId: string;
}

export function SurveyConfigEditor({ csatConfig, npsConfig, workspaceId }: Props) {
  return (
    <Tabs defaultValue="csat" className="space-y-4">
      <TabsList>
        <TabsTrigger value="csat">CSAT</TabsTrigger>
        <TabsTrigger value="nps">NPS</TabsTrigger>
      </TabsList>

      <TabsContent value="csat">
        <SurveyForm
          type="CSAT"
          config={csatConfig}
          workspaceId={workspaceId}
          description="Customer Satisfaction surveys measure how happy customers are with your support (1-5 stars)."
          defaultQuestion="How would you rate your experience?"
        />
      </TabsContent>

      <TabsContent value="nps">
        <SurveyForm
          type="NPS"
          config={npsConfig}
          workspaceId={workspaceId}
          description="Net Promoter Score surveys measure customer loyalty (0-10 scale)."
          defaultQuestion="How likely are you to recommend us to a friend?"
        />
      </TabsContent>
    </Tabs>
  );
}

function SurveyForm({
  type,
  config,
  workspaceId,
  description,
  defaultQuestion,
}: {
  type: "CSAT" | "NPS";
  config: SurveyConfig | null;
  workspaceId: string;
  description: string;
  defaultQuestion: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [isEnabled, setIsEnabled] = useState(config?.isEnabled ?? false);
  const [trigger, setTrigger] = useState(config?.trigger ?? "ON_CLOSE");
  const [delayMinutes, setDelayMinutes] = useState(config?.delayMinutes ?? 0);
  const [questionText, setQuestionText] = useState(
    config?.questionText ?? defaultQuestion,
  );
  const [thankYouText, setThankYouText] = useState(
    config?.thankYouText ?? "Thank you for your feedback!",
  );

  function handleSave() {
    startTransition(async () => {
      const result = await upsertSurveyConfig(workspaceId, {
        type,
        isEnabled,
        trigger: trigger as "ON_CLOSE" | "AFTER_DELAY",
        delayMinutes,
        questionText,
        thankYouText,
      });

      if (result.status === "error") {
        toast.error(result.message);
      } else {
        toast.success(`${type} configuration saved`);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{type} Survey</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Trigger</Label>
          <Select value={trigger} onValueChange={(v) => setTrigger(v as "ON_CLOSE" | "AFTER_DELAY")}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ON_CLOSE">When conversation is closed</SelectItem>
              <SelectItem value="AFTER_DELAY">After a delay</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {trigger === "AFTER_DELAY" && (
          <div className="space-y-2">
            <Label>Delay after close (minutes)</Label>
            <Input
              type="number"
              min={0}
              max={10080}
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
              className="w-32"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Question Text</Label>
          <Input
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Thank You Message</Label>
          <Input
            value={thankYouText}
            onChange={(e) => setThankYouText(e.target.value)}
          />
        </div>

        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save Configuration"}
        </Button>
      </CardContent>
    </Card>
  );
}
