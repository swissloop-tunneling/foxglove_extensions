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
export enum ModelTypes {
  ACTION = "action",
  CONDITION = "condition",
  CONTROL = "control",
  DECORATOR = "decorator",
  SUBTREE = "subtree",
}

export enum NodeStatus {
  IDLE = 0,
  RUNNING = 1,
  SUCCESS = 2,
  FAILURE = 3,
  SKIPPED = 4,
}

export const NODE_STATUS_NAMES = [
  "IDLE",
  "RUNNING",
  "SUCCESS",
  "FAILURE",
  "SKIPPED",
] as const;
export type NodeStatusName = (typeof NODE_STATUS_NAMES)[number];

export enum PortDirection {
  INPUT = "input",
  OUTPUT = "output",
  INOUT = "inout",
}

export type Port = {
  name: string;
  direction: PortDirection;
  type: string;
  description: string;
};

export type Model = {
  type: ModelTypes;
  id: string;
  ports: Port[];
};

export type TreeNode = {
  id: string;
  name: string;
  model: string;
  children?: TreeNode[];
  ports?: {
    [key: string]: string | number | boolean;
  };
  attributes?: {
    [key: string]: string | number | boolean;
  };
};

// Marmot (Swissloop Tunneling): one <BehaviorTree> block of the XML, the main tree or a sub-tree
export type TreeInfo = {
  id: string; // ID of the tree, e.g. "InchwormCycle"
  fullpath: string; // _fullpath of BT::WriteTreeToXML, "" for the main tree
  parentFullpath?: string; // tree that includes it, undefined for the main tree
  depth: number; // 0 = main tree
  rootId?: string; // graph id of its root node
  uids: string[]; // _uid of its own nodes (without those of its sub-trees)
};

export type TBehaviorTree = {
  models: {
    [name: string]: Model;
  };
  root: TreeNode;
  trees?: TreeInfo[]; // Marmot: main tree first, sub-trees in the order they are used
  metadata?: {
    version?: string;
    description?: string;
    mainTreeToExecute?: string;
  };
};

// ROS Time type
export type Timestamp = {
  sec: number;
  nsec: number;
};

// Individual log event for a node status change
export type BehaviorTreeLogEvent = {
  timestamp: Timestamp;
  node_name: string;
  uid: number;
  previous_status: keyof typeof NodeStatus | string;
  current_status: keyof typeof NodeStatus | string;
};

// Complete behavior tree log message
export type BehaviorTreeLog = {
  timestamp: Timestamp;
  event_log: BehaviorTreeLogEvent[];
};

export type NodeStatusSnapshot = {
  byUid: Readonly<Record<string, NodeStatusName>>;
  byName: Readonly<Record<string, NodeStatusName>>;
};
