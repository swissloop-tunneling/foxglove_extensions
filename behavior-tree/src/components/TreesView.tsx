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

// The trees in the loaded XML (main tree and sub-trees) with their live state, and a one-line
// summary of which tree runs right now.
import { ReactElement } from "react";

import { activeTreePath, treeStatus } from "@/treeStatus";
import { NodeStatusName, NodeStatusSnapshot, TreeInfo } from "@/types";

const STATUS_CLASS: Record<NodeStatusName, string> = {
  IDLE: "bg-slate-500",
  RUNNING: "bg-amber-400 animate-pulse",
  SUCCESS: "bg-green-500",
  FAILURE: "bg-red-500",
  SKIPPED: "bg-slate-700",
};

/** Above the graph: main tree and the trees that run now, e.g. "InchwormToGoal ▸ InchwormCycle" */
export function ActiveTreeLine({
  trees,
  nodeStatuses,
}: {
  trees?: readonly TreeInfo[];
  nodeStatuses: NodeStatusSnapshot;
}): ReactElement | null {
  if (!trees || trees.length === 0) {
    return null;
  }
  const path = activeTreePath(trees, nodeStatuses);
  const main = trees[0];
  return (
    <div className="absolute top-2 left-2 z-10 rounded-md bg-background/90 dark:bg-slate-900/90 border border-border dark:border-slate-700 px-2 py-1 text-xs">
      <span className="text-muted-foreground">Tree: </span>
      {path.length > 0 ? (
        path.map((tree, index) => (
          <span key={tree.fullpath}>
            {index > 0 && <span className="text-muted-foreground"> ▸ </span>}
            <span className={index === path.length - 1 ? "text-amber-400 font-semibold" : ""}>
              {tree.id}
            </span>
          </span>
        ))
      ) : (
        <span>
          {main?.id} <span className="text-muted-foreground">(not running)</span>
        </span>
      )}
    </div>
  );
}

/** Sidebar tab: every tree of the XML, sub-trees indented below the tree that uses them */
export function TreesView({
  trees,
  nodeStatuses,
}: {
  trees?: readonly TreeInfo[];
  nodeStatuses: NodeStatusSnapshot;
}): ReactElement {
  if (!trees || trees.length === 0) {
    return <div className="text-center text-sm text-muted-foreground p-4">No tree loaded</div>;
  }
  const active = new Set(activeTreePath(trees, nodeStatuses).map((tree) => tree.fullpath));
  return (
    <div className="p-2 space-y-1">
      {trees.map((tree) => {
        const status = treeStatus(tree, nodeStatuses);
        return (
          <div
            key={tree.fullpath}
            className={`flex items-center gap-2 rounded-sm px-2 py-1 text-xs ${active.has(tree.fullpath) ? "bg-amber-400/15" : ""}`}
            style={{ marginLeft: `${tree.depth * 16}px` }}
            title={tree.fullpath ? `instance ${tree.fullpath}` : "main tree"}
          >
            <span className={`inline-block h-2 w-2 rounded-full ${STATUS_CLASS[status]}`} />
            <span className="font-mono">{tree.id}</span>
            <span className="text-muted-foreground">
              {tree.depth === 0 ? "main tree" : "sub-tree"} · {status.toLowerCase()} ·{" "}
              {tree.uids.length} nodes
            </span>
          </div>
        );
      })}
    </div>
  );
}
