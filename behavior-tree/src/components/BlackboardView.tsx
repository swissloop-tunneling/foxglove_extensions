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

// Blackboard of the running tree, from a std_msgs/String with JSON as BT::ExportTreeToJSON
// writes it: {"<tree>": {"<key>": <value>, ...}, ...}
import { ReactElement, useMemo } from "react";

export type BlackboardData = Record<string, Record<string, unknown>>;

export function parseBlackboard(json?: string): BlackboardData | undefined {
  if (!json) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return undefined;
    }
    const result: BlackboardData = {};
    for (const [tree, entries] of Object.entries(parsed as Record<string, unknown>)) {
      if (entries != null && typeof entries === "object" && !Array.isArray(entries)) {
        result[tree] = entries as Record<string, unknown>;
      }
    }
    return result;
  } catch {
    return undefined;
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    // BT values are often numbers written as strings, e.g. "5.000000"
    const number = Number(value);
    if (value.trim() !== "" && Number.isFinite(number)) {
      return String(Math.round(number * 1000) / 1000);
    }
    return value;
  }
  return JSON.stringify(value);
}

export function BlackboardView({ json }: { json?: string }): ReactElement {
  const data = useMemo(() => parseBlackboard(json), [json]);

  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground p-4">
        No blackboard data (topic behavior_tree_blackboard of bt_runner_node)
      </div>
    );
  }

  return (
    <div className="p-2 space-y-3">
      {Object.entries(data).map(([tree, entries]) => (
        <div key={tree}>
          <div className="text-xs font-medium mb-1">{tree}</div>
          <table className="w-full text-xs font-mono">
            <tbody>
              {Object.keys(entries)
                .sort()
                .map((key) => (
                  <tr key={key} className="border-b border-border/40 dark:border-slate-700/60">
                    <td className="py-0.5 pr-3 text-purple-600 dark:text-purple-300">{key}</td>
                    <td className="py-0.5 text-right">{formatValue(entries[key])}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
