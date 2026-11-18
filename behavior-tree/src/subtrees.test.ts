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

// Trees with sub-trees as BT::WriteTreeToXML(tree, true, true) writes them (Project Marmot).
import { describe, expect, it } from "vitest";

import { parseBehaviorTreeXML } from "./parse";
import { activeTreePath, treeStatus } from "./treeStatus";
import { NodeStatusSnapshot, TreeNode } from "./types";

// Shortened copy of what bt_runner_node publishes for inchworm_to_goal.xml
const TWO_LEVELS = `<root BTCPP_format="4" BTCPP_version="4.11">
  <BehaviorTree ID="InchwormToGoal" _fullpath="">
    <Sequence name="ToGoal" _uid="1">
      <ForceSuccess name="ForceSuccess" _uid="2">
        <KeepRunningUntilFailure name="KeepRunningUntilFailure" _uid="3">
          <Sequence name="NextStroke" _uid="4">
            <CalcNextExtension name="CalcNext" _uid="5" goal_forward_mm="500.0"/>
            <SubTree ID="InchwormCycle" _fullpath="InchwormCycle::6" _uid="6"/>
          </Sequence>
        </KeepRunningUntilFailure>
      </ForceSuccess>
      <CheckGoalReached name="CheckGoalReached" _uid="14" goal_reached="{goal_reached}"/>
    </Sequence>
  </BehaviorTree>
  <BehaviorTree ID="InchwormCycle" _fullpath="InchwormCycle::6">
    <Sequence name="InchwormCycleSequence" _uid="7">
      <SetGripperRear name="ClampGripperRear" _uid="8" state="EXPANDED"/>
      <SetGripperFront name="ReleaseGripperFront" _uid="9" state="RETRACTED"/>
      <SetPistons name="ExtendArms" _uid="10" piston_1_mm="{extend_p1}"/>
      <SetGripperFront name="ClampGripperFront" _uid="11" state="EXPANDED"/>
      <SetGripperRear name="ReleaseGripperRear" _uid="12" state="RETRACTED"/>
      <SetPistons name="RetractArms" _uid="13" piston_1_mm="{retract_p1}"/>
    </Sequence>
  </BehaviorTree>
</root>`;

// Three levels, as for e2e_test_tree_inchworm.xml: E2ETestTree > InchwormToGoal > InchwormCycle
const THREE_LEVELS = `<root BTCPP_format="4">
  <BehaviorTree ID="E2ETestTree" _fullpath="">
    <Sequence name="E2E" _uid="1">
      <SubTree ID="InchwormToGoal" _fullpath="InchwormToGoal::2" _uid="2"/>
    </Sequence>
  </BehaviorTree>
  <BehaviorTree ID="InchwormToGoal" _fullpath="InchwormToGoal::2">
    <Sequence name="ToGoal" _uid="3">
      <SubTree ID="InchwormCycle" _fullpath="InchwormToGoal::2/InchwormCycle::4" _uid="4"/>
    </Sequence>
  </BehaviorTree>
  <BehaviorTree ID="InchwormCycle" _fullpath="InchwormToGoal::2/InchwormCycle::4">
    <Sequence name="InchwormCycleSequence" _uid="5">
      <SetPistons name="ExtendArms" _uid="6"/>
    </Sequence>
  </BehaviorTree>
</root>`;

function find(node: TreeNode, id: string): TreeNode | undefined {
  if (node.id === id) {
    return node;
  }
  for (const child of node.children ?? []) {
    const found = find(child, id);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function snapshot(byUid: Record<string, string>): NodeStatusSnapshot {
  return { byUid: byUid as NodeStatusSnapshot["byUid"], byName: {} };
}

describe("trees with sub-trees", () => {
  it("uses the root node of the main tree, not the <BehaviorTree> block", () => {
    const tree = parseBehaviorTreeXML(TWO_LEVELS);
    expect(tree.root.model).toBe("Sequence");
    expect(tree.root.name).toBe("ToGoal");
    expect(tree.root.attributes?._uid).toBe("1");
  });

  it("hangs the content of a sub-tree below its SubTree node", () => {
    const tree = parseBehaviorTreeXML(TWO_LEVELS);
    const subTree = find(tree.root, "6");
    expect(subTree?.model).toBe("SubTree");
    expect(subTree?.name).toBe("InchwormCycle");
    expect(subTree?.children?.[0]?.name).toBe("InchwormCycleSequence");
    for (const uid of ["7", "8", "9", "10", "11", "12", "13"]) {
      expect(find(tree.root, uid)).toBeDefined();
    }
  });

  it("keeps the order of the file, also for repeated node types", () => {
    const tree = parseBehaviorTreeXML(TWO_LEVELS);
    const cycle = find(tree.root, "7");
    expect(cycle?.children?.map((child) => child.name)).toEqual([
      "ClampGripperRear",
      "ReleaseGripperFront",
      "ExtendArms",
      "ClampGripperFront",
      "ReleaseGripperRear",
      "RetractArms",
    ]);
  });

  it("lists the trees with their own nodes", () => {
    const tree = parseBehaviorTreeXML(TWO_LEVELS);
    expect(tree.trees?.map((t) => [t.id, t.depth, t.parentFullpath])).toEqual([
      ["InchwormToGoal", 0, undefined],
      ["InchwormCycle", 1, ""],
    ]);
    expect(tree.trees?.[0]?.uids).toEqual(["1", "2", "3", "4", "5", "6", "14"]);
    expect(tree.trees?.[1]?.uids).toEqual(["7", "8", "9", "10", "11", "12", "13"]);
  });

  it("resolves sub-trees inside sub-trees", () => {
    const tree = parseBehaviorTreeXML(THREE_LEVELS);
    expect(tree.trees?.map((t) => t.id)).toEqual([
      "E2ETestTree",
      "InchwormToGoal",
      "InchwormCycle",
    ]);
    expect(tree.trees?.map((t) => t.depth)).toEqual([0, 1, 2]);
    expect(find(tree.root, "6")?.name).toBe("ExtendArms");
  });

  it("tells which trees run", () => {
    const trees = parseBehaviorTreeXML(TWO_LEVELS).trees ?? [];
    const running = snapshot({ "1": "RUNNING", "6": "RUNNING", "7": "RUNNING", "10": "RUNNING" });
    expect(activeTreePath(trees, running).map((t) => t.id)).toEqual([
      "InchwormToGoal",
      "InchwormCycle",
    ]);
    expect(treeStatus(trees[1]!, running)).toBe("RUNNING");

    const planning = snapshot({ "1": "RUNNING", "5": "RUNNING", "7": "IDLE" });
    expect(activeTreePath(trees, planning).map((t) => t.id)).toEqual(["InchwormToGoal"]);
    expect(treeStatus(trees[1]!, planning)).toBe("IDLE");

    const done = snapshot({ "1": "SUCCESS" });
    expect(activeTreePath(trees, done)).toEqual([]);
    expect(treeStatus(trees[0]!, done)).toBe("SUCCESS");
  });

  it("does not loop on a sub-tree that includes itself", () => {
    const xml = `<root BTCPP_format="4">
      <BehaviorTree ID="A"><Sequence name="S" _uid="1"><SubTree ID="A" _uid="2"/></Sequence></BehaviorTree>
      <BehaviorTree ID="B"><Sequence name="T" _uid="3"/></BehaviorTree>
    </root>`;
    const tree = parseBehaviorTreeXML(xml);
    expect(find(tree.root, "2")?.children).toBeUndefined();
  });
});
