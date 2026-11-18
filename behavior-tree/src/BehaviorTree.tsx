// Copyright (c) 2025-present Polymath Robotics, Inc.
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
//
// Modified by Swissloop Tunneling (Project Marmot): blackboard and node states passed to the
// sidebar, line with the running tree above the graph, library file shown instead of the live
// tree until "Back to live".
import { ReactElement, useMemo, useState } from "react";

import { Graph } from "./components/Graph";
import { GraphContextProvider } from "./components/GraphContextProvider";
import { ActiveTreeLine } from "./components/TreesView";
import { libraryTree, parseLibrary } from "./library";
import { EMPTY_NODE_STATUS_SNAPSHOT } from "./liveState";
import { parseBehaviorTreeXML } from "./parse";
import { NodeStatusSnapshot, TBehaviorTree } from "./types";

import { RightSidebar } from "@/components/RightSidebar";
import { Button } from "@/components/ui/button";

interface BehaviorTreeProps {
  xml?: string;
  nodeStatuses?: NodeStatusSnapshot;
  blackboardJson?: string;
  libraryJson?: string;
}

export function BehaviorTree({
  xml,
  nodeStatuses = EMPTY_NODE_STATUS_SNAPSHOT,
  blackboardJson,
  libraryJson,
}: BehaviorTreeProps): ReactElement {
  const behaviorTree: TBehaviorTree | null = useMemo(() => {
    if (xml) {
      try {
        const parsedTree = parseBehaviorTreeXML(xml);
        return parsedTree;
      } catch (error) {
        console.error("Failed to parse behavior tree XML:", error);
      }
    }
    return null;
  }, [xml]);

  // Marmot: tree library; while a file is selected the graph shows it instead of the live tree
  const libraryFiles = useMemo(() => parseLibrary(libraryJson), [libraryJson]);
  const [libraryPath, setLibraryPath] = useState<string | undefined>();
  const selectedTree = useMemo(
    () => (libraryPath !== undefined ? libraryTree(libraryPath, libraryFiles) : null),
    [libraryPath, libraryFiles],
  );
  const showLibrary = libraryPath !== undefined;

  return (
    <GraphContextProvider>
      <div className="h-full w-full relative flex">
        <div className="flex-1 relative">
          {showLibrary ? (
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2 rounded-md bg-background/90 dark:bg-slate-900/90 border border-sky-500/60 px-2 py-1 text-xs">
              <span className="text-sky-400">Library:</span>
              <span className="font-mono">{libraryPath}</span>
              <span className="text-muted-foreground">(not live)</span>
              <Button
                size="sm"
                variant="secondary"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  setLibraryPath(undefined);
                }}
              >
                Back to live
              </Button>
            </div>
          ) : (
            <ActiveTreeLine trees={behaviorTree?.trees} nodeStatuses={nodeStatuses} />
          )}
          <Graph
            behaviorTree={showLibrary ? selectedTree : behaviorTree}
            nodeStatuses={showLibrary ? EMPTY_NODE_STATUS_SNAPSHOT : nodeStatuses}
          />
        </div>

        <RightSidebar
          behaviorTree={behaviorTree}
          xml={xml}
          blackboardJson={blackboardJson}
          nodeStatuses={nodeStatuses}
          libraryFiles={libraryFiles}
          libraryPath={libraryPath}
          onSelectLibrary={setLibraryPath}
        />
      </div>
    </GraphContextProvider>
  );
}
