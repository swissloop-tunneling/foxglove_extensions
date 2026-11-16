// Copyright (c) 2026-present Swissloop Tunneling (Project Marmot)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Operator controls above the tree: goal position, start and stop of the behaviour tree, and the
// state reported by the mission node (tbm_mission in Project Marmot).
import { Crosshair, Play, Square } from "lucide-react";
import { ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type Goal = { x: number; y: number; z: number };

interface ControlBarProps {
  canPublish: boolean;
  canCallServices: boolean;
  status?: string;
  step?: string;
  feedback?: string;
  onSetGoal: (goal: Goal) => void;
  onStart: () => void;
  onStop: () => void;
}

const FIELDS: Array<{ key: keyof Goal; label: string; title: string }> = [
  { key: "x", label: "Forward", title: "Forward [mm], from where the machine is at start" },
  { key: "y", label: "Left", title: "Left [mm], negative = right" },
  { key: "z", label: "Up", title: "Up [mm], negative = down" },
];

function stateColor(status?: string): string {
  if (!status) {
    return "text-muted-foreground";
  }
  if (status.startsWith("RUNNING")) {
    return "text-sky-400";
  }
  if (status.startsWith("GOAL_REACHED") || status.startsWith("READY")) {
    return "text-green-400";
  }
  if (status.startsWith("FAILED") || status.startsWith("STOPPED")) {
    return "text-red-400";
  }
  return "text-foreground";
}

export function ControlBar({
  canPublish,
  canCallServices,
  status,
  step,
  feedback,
  onSetGoal,
  onStart,
  onStop,
}: ControlBarProps): ReactElement {
  const [values, setValues] = useState<Record<keyof Goal, string>>({ x: "500", y: "0", z: "0" });

  const goal: Goal = { x: Number(values.x), y: Number(values.y), z: Number(values.z) };
  const goalValid = [goal.x, goal.y, goal.z].every((value) => Number.isFinite(value));

  return (
    <div className="border-b border-border dark:border-slate-700 bg-background dark:bg-slate-900 p-2 space-y-1.5">
      <div className="flex flex-wrap items-end gap-2">
        {FIELDS.map((field) => (
          <label
            key={field.key}
            className="flex flex-col text-xs text-muted-foreground"
            title={field.title}
          >
            {field.label} [mm]
            <Input
              className="h-8 w-24 text-sm"
              inputMode="decimal"
              value={values[field.key]}
              onChange={(event) => {
                setValues((previous) => ({ ...previous, [field.key]: event.target.value }));
              }}
            />
          </label>
        ))}
        <Button
          size="sm"
          variant="secondary"
          disabled={!canPublish || !goalValid}
          title={
            canPublish
              ? "Send the goal to the mission node"
              : "The connection does not allow publishing"
          }
          onClick={() => {
            onSetGoal(goal);
          }}
        >
          <Crosshair /> Set goal
        </Button>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          disabled={!canCallServices}
          title="Drive to the goal"
          onClick={onStart}
        >
          <Play /> Start
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={!canCallServices}
          title="Stop and hold the pistons where they are"
          onClick={onStop}
        >
          <Square /> Stop
        </Button>
      </div>
      <div className="text-xs font-mono space-y-0.5">
        <div className={stateColor(status)}>
          {status ?? "no status yet (is the mission node running?)"}
        </div>
        {step && <div className="text-muted-foreground">{step}</div>}
        {feedback && <div className="text-amber-400">{feedback}</div>}
      </div>
    </div>
  );
}
