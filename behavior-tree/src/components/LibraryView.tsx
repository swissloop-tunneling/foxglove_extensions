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

// Sidebar tab with every behaviour tree file of the library; a click shows the file in the graph.
import { ReactElement } from "react";

import { LibraryFile, mainTreeId } from "@/library";
import { TreeInfo } from "@/types";

export function LibraryView({
  files,
  liveTrees,
  selectedPath,
  onSelect,
}: {
  files: readonly LibraryFile[];
  liveTrees?: readonly TreeInfo[];
  selectedPath?: string;
  onSelect: (path: string) => void;
}): ReactElement {
  if (files.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground p-4">
        No tree library (topic behavior_tree_library of tbm_mission, sent when the simulation
        starts)
      </div>
    );
  }
  const liveMain = liveTrees?.[0]?.id;
  const liveSubTrees = new Set(liveTrees?.slice(1).map((tree) => tree.id));

  return (
    <div className="p-2 space-y-1">
      {files.map((file) => {
        const main = mainTreeId(file.xml);
        const selected = file.path === selectedPath;
        return (
          <button
            key={file.path}
            type="button"
            onClick={() => {
              onSelect(file.path);
            }}
            className={`w-full text-left rounded-sm px-2 py-1 text-xs hover:bg-accent/50 dark:hover:bg-accent/30 ${selected ? "bg-accent/60 dark:bg-accent/40" : ""}`}
            title="Show this file in the graph"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono">{file.path}</span>
              {main !== undefined && main === liveMain && (
                <span className="rounded bg-amber-400/20 px-1 text-amber-400">live</span>
              )}
              {main !== undefined && liveSubTrees.has(main) && (
                <span className="rounded bg-sky-400/20 px-1 text-sky-400">used as sub-tree</span>
              )}
            </div>
            <div className="text-muted-foreground">main tree: {main ?? "?"}</div>
          </button>
        );
      })}
    </div>
  );
}
