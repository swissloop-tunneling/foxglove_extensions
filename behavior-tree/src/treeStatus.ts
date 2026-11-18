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

// Live state of the main tree and its sub-trees, from the node states of the BehaviorTreeLog.
import type { NodeStatusName, NodeStatusSnapshot, TreeInfo } from "./types";

/** RUNNING if one of its own nodes runs, otherwise the state of its root node (IDLE if unknown). */
export function treeStatus(tree: TreeInfo, snapshot: NodeStatusSnapshot): NodeStatusName {
  if (tree.uids.some((uid) => snapshot.byUid[uid] === "RUNNING")) {
    return "RUNNING";
  }
  const rootUid = tree.uids[0];
  return (rootUid !== undefined ? snapshot.byUid[rootUid] : undefined) ?? "IDLE";
}

/**
 * The trees that run right now, from the main tree down to the deepest sub-tree, e.g.
 * [InchwormToGoal, InchwormCycle]. Empty when nothing runs.
 */
export function activeTreePath(
  trees: readonly TreeInfo[],
  snapshot: NodeStatusSnapshot,
): TreeInfo[] {
  const running = trees.filter((tree) => treeStatus(tree, snapshot) === "RUNNING");
  const deepest = running.reduce<TreeInfo | undefined>(
    (best, tree) => (best === undefined || tree.depth > best.depth ? tree : best),
    undefined,
  );
  const path: TreeInfo[] = [];
  let current = deepest;
  while (current) {
    path.unshift(current);
    const parentPath = current.parentFullpath;
    current =
      parentPath === undefined ? undefined : trees.find((tree) => tree.fullpath === parentPath);
  }
  return path;
}
