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
import { describe, expect, it } from "vitest";

import { collectBlocks, libraryTree, mainTreeId, parseLibrary } from "./library";
import { TreeNode } from "./types";

// Shortened copies of the files in inco_bt_runner/BTs (as on disk: <include>, no _uid)
const CYCLE = `<root BTCPP_format="4">
  <BehaviorTree ID="InchwormCycle">
    <Sequence name="InchwormCycleSequence">
      <SetGripperRear name="ClampGripperRear" state="EXPANDED" />
      <SetGripperFront name="ReleaseGripperFront" state="RETRACTED" />
      <!-- Forward Extension in mm -->
      <SetPistons name="ExtendArms" piston_1_mm="{extend_p1}" />
      <SetGripperFront name="ClampGripperFront" state="EXPANDED" />
      <SetGripperRear name="ReleaseGripperRear" state="RETRACTED" />
      <SetPistons name="RetractArms" piston_1_mm="{retract_p1}" />
    </Sequence>
  </BehaviorTree>
</root>`;

const TO_GOAL = `<root BTCPP_format="4" main_tree_to_execute="InchwormToGoal">
  <include path="inchwormCycle.xml" />
  <BehaviorTree ID="InchwormToGoal">
    <Sequence name="ToGoal">
      <CalcNextExtension name="CalcNext" goal_forward_mm="500.0" />
      <SubTree ID="InchwormCycle" _autoremap="true" />
    </Sequence>
  </BehaviorTree>
</root>`;

const E2E = `<root BTCPP_format="4">
  <include path="./inchworm_to_goal.xml" />
  <BehaviorTree ID="E2ETestTree">
    <Sequence name="E2E">
      <SubTree ID="InchwormToGoal" _autoremap="true" />
      <SubTree ID="InchwormToGoal" _autoremap="true" />
    </Sequence>
  </BehaviorTree>
</root>`;

const LIBRARY = JSON.stringify({
  "test_trees/inchworm_to_goal.xml": TO_GOAL,
  "test_trees/inchwormCycle.xml": CYCLE,
  "test_trees/e2e_test_tree_inchworm.xml": E2E,
});

function all(node: TreeNode): TreeNode[] {
  return [node, ...(node.children ?? []).flatMap(all)];
}

describe("tree library", () => {
  it("reads the files sorted by path and ignores broken data", () => {
    expect(parseLibrary(LIBRARY).map((file) => file.path)).toEqual([
      "test_trees/e2e_test_tree_inchworm.xml",
      "test_trees/inchworm_to_goal.xml",
      "test_trees/inchwormCycle.xml",
    ]);
    expect(parseLibrary(undefined)).toEqual([]);
    expect(parseLibrary("{broken")).toEqual([]);
    expect(parseLibrary('{"a.xml": 3}')).toEqual([]);
  });

  it("finds the main tree of a file", () => {
    expect(mainTreeId(TO_GOAL)).toBe("InchwormToGoal");
    expect(mainTreeId(CYCLE)).toBe("InchwormCycle");
    expect(mainTreeId(E2E)).toBe("E2ETestTree");
  });

  it("resolves <include> relative to the including file, main tree first", () => {
    const files = parseLibrary(LIBRARY);
    const ids = collectBlocks("test_trees/e2e_test_tree_inchworm.xml", files).map(
      (block) => /ID="([^"]+)"/.exec(block)?.[1],
    );
    expect(ids).toEqual(["E2ETestTree", "InchwormToGoal", "InchwormCycle"]);
  });

  it("shows a file with its sub-trees in the order of the file", () => {
    const tree = libraryTree("test_trees/inchworm_to_goal.xml", parseLibrary(LIBRARY));
    expect(tree?.root.name).toBe("ToGoal");
    const names = all(tree!.root).map((node) => node.name);
    expect(names).toEqual([
      "ToGoal",
      "CalcNext",
      "InchwormCycle",
      "InchwormCycleSequence",
      "ClampGripperRear",
      "ReleaseGripperFront",
      "ExtendArms",
      "ClampGripperFront",
      "ReleaseGripperRear",
      "RetractArms",
    ]);
    expect(tree?.trees?.map((t) => t.id)).toEqual(["InchwormToGoal", "InchwormCycle"]);
  });

  it("gives unique graph ids, also for a sub-tree used twice", () => {
    const tree = libraryTree("test_trees/e2e_test_tree_inchworm.xml", parseLibrary(LIBRARY));
    const nodes = all(tree!.root);
    expect(nodes.filter((node) => node.name === "ExtendArms")).toHaveLength(2);
    expect(new Set(nodes.map((node) => node.id)).size).toBe(nodes.length);
  });

  it("names nodes without a name after their type", () => {
    const xml = `<root BTCPP_format="4"><BehaviorTree ID="T"><Sequence name="S">
      <ForceSuccess><KeepRunningUntilFailure><AlwaysSuccess/></KeepRunningUntilFailure></ForceSuccess>
    </Sequence></BehaviorTree></root>`;
    const tree = libraryTree("t.xml", parseLibrary(JSON.stringify({ "t.xml": xml })));
    expect(all(tree!.root).map((node) => node.name)).toEqual([
      "S",
      "ForceSuccess",
      "KeepRunningUntilFailure",
      "AlwaysSuccess",
    ]);
  });

  it("returns null for an unknown file", () => {
    expect(libraryTree("nope.xml", parseLibrary(LIBRARY))).toBeNull();
  });
});
