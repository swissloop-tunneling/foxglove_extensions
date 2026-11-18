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
// Modified by Swissloop Tunneling (Project Marmot): several <BehaviorTree> blocks (sub-trees
// included with <include>/<SubTree>): the main tree is the root, the content of every SubTree is
// hung below its SubTree node, and the trees are listed in `trees`. Marked with "Marmot".
import { XMLParser } from "fast-xml-parser";

import { TBehaviorTree, TreeInfo, TreeNode, Model, ModelTypes, PortDirection } from "./types";

// Marmot: state while the trees are parsed
type ParseContext = {
  blocksByPath: Map<string, any>;
  blocksById: Map<string, any>;
  trees: TreeInfo[];
  current?: TreeInfo;
  open: Set<any>; // blocks on the current path, against sub-trees that include themselves
};

type ParsedXMLObject = {
  root: {
    TreeNodesModel?: Record<string, any>;
    BehaviorTree?: any;
    [key: string]: any;
  };
};

export function parseBehaviorTreeXML(xmlContent: string): TBehaviorTree {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  const xmlObject = parser.parse(xmlContent) as ParsedXMLObject;

  const models = parseModels(xmlObject);
  const trees: TreeInfo[] = []; // Marmot
  const root = parseBehaviorTreeTag(xmlObject, trees);

  return {
    models,
    root,
    trees,
  };
}

function parseModels(xmlObject: ParsedXMLObject): TBehaviorTree["models"] {
  const models: TBehaviorTree["models"] = {};

  // Parse TreeNodesModel section
  const treeNodesModel = xmlObject?.root?.TreeNodesModel;
  if (treeNodesModel) {
    // Parse each node type (Action, Condition, Decorator, etc.)
    for (const [nodeType, nodeDefinitions] of Object.entries(treeNodesModel)) {
      const definitions = Array.isArray(nodeDefinitions) ? nodeDefinitions : [nodeDefinitions];

      for (const definition of definitions) {
        if (typeof definition === "object" && definition?.["@_ID"]) {
          const model: Model = {
            id: definition["@_ID"],
            type: getModelType(nodeType),
            ports: [],
          };

          // Parse ports (input_port, output_port, inout_port)
          for (const [portType, portData] of Object.entries(definition)) {
            if (portType.endsWith("_port")) {
              const ports = Array.isArray(portData) ? portData : [portData];

              for (const port of ports) {
                if (typeof port === "object" && port?.["@_name"]) {
                  model.ports.push({
                    name: port["@_name"],
                    direction: getPortDirection(portType),
                    type: port["@_type"] || "string",
                    description: port["#text"] || "",
                  });
                }
              }
            }
          }

          models[model.id] = model;
        }
      }
    }
  }

  // Add built-in control flow models
  models["Sequence"] = {
    id: "Sequence",
    type: ModelTypes.CONTROL,
    ports: [],
  };

  models["Fallback"] = {
    id: "Fallback",
    type: ModelTypes.CONTROL,
    ports: [],
  };

  return models;
}

function parseBehaviorTreeTag(xmlObject: ParsedXMLObject, trees: TreeInfo[] = []): TreeNode {
  const behaviorTree = xmlObject?.root?.BehaviorTree;

  if (!behaviorTree) {
    // Return default root if no BehaviorTree tag found
    return {
      id: "root",
      name: "root",
      model: "Sequence",
    };
  }

  // Marmot: with sub-trees there are several <BehaviorTree> blocks (an array). The main tree is
  // main_tree_to_execute or the first block (BT::WriteTreeToXML writes the main tree first).
  const blocks: any[] = Array.isArray(behaviorTree) ? behaviorTree : [behaviorTree];
  const context: ParseContext = {
    blocksByPath: new Map(),
    blocksById: new Map(),
    trees,
    open: new Set(),
  };
  for (const block of blocks) {
    if (block?.["@__fullpath"] !== undefined) {
      context.blocksByPath.set(String(block["@__fullpath"]), block);
    }
    if (block?.["@_ID"] !== undefined && !context.blocksById.has(String(block["@_ID"]))) {
      context.blocksById.set(String(block["@_ID"]), block);
    }
  }
  const mainId = xmlObject?.root?.["@_main_tree_to_execute"];
  const main =
    (mainId !== undefined ? context.blocksById.get(String(mainId)) : undefined) ?? blocks[0];

  return parseTreeBlock(main, context, undefined, 0);
}

// Marmot: the root node of one <BehaviorTree> block, registered in context.trees
function parseTreeBlock(
  block: any,
  context: ParseContext,
  parentFullpath: string | undefined,
  depth: number,
): TreeNode {
  // Find the first child element (should be the root node of the tree)
  const rootNodeKey =
    block && typeof block === "object"
      ? Object.keys(block).find((key) => !key.startsWith("@_"))
      : undefined;

  if (!rootNodeKey) {
    return {
      id: "root",
      name: "root",
      model: "Sequence",
    };
  }

  const info: TreeInfo = {
    id: String(block["@_ID"] ?? `tree ${context.trees.length + 1}`),
    fullpath: String(block["@__fullpath"] ?? ""),
    parentFullpath,
    depth,
    uids: [],
  };
  context.trees.push(info);

  const outer = context.current;
  context.current = info;
  context.open.add(block);
  const rootNodeData = block[rootNodeKey];
  const root = parseTreeNode(rootNodeKey, rootNodeData, context);
  context.open.delete(block);
  context.current = outer;

  info.rootId = root.id;
  // Document order, see the sorting of the children in parseTreeNode
  if (info.uids.every((uid) => Number.isInteger(Number(uid)))) {
    info.uids.sort((a, b) => Number(a) - Number(b));
  }
  return root;
}

// Marmot: _uid of a parsed node as a number, undefined if it has none
function uidNumber(node: TreeNode): number | undefined {
  const uid = node.attributes?._uid;
  const value = typeof uid === "number" ? uid : Number(uid);
  return uid !== undefined && Number.isInteger(value) ? value : undefined;
}

function parseTreeNode(nodeName: string, nodeData: any, context?: ParseContext): TreeNode {
  const id = nodeData?.["@__uid"] || nodeData?.["@_ID"] || nodeData?.["@_name"] || nodeName;
  // Marmot: a SubTree node has no name, show the ID of its tree
  const name =
    nodeData?.["@_name"] || (nodeName === "SubTree" ? nodeData?.["@_ID"] : undefined) || id;
  if (context?.current && nodeData?.["@__uid"] !== undefined) {
    context.current.uids.push(String(nodeData["@__uid"]));
  }

  const node: TreeNode = {
    id,
    name,
    model: nodeName,
  };

  // Parse attributes (excluding special ones)
  const attributes: { [key: string]: string | number | boolean } = {};
  if (nodeData && typeof nodeData === "object") {
    for (const [key, value] of Object.entries(nodeData)) {
      if (key.startsWith("@_") && key !== "@_ID" && key !== "@_name") {
        const attrName = key.substring(2); // Remove "@_" prefix
        attributes[attrName] = value as string | number | boolean;
      }
    }
  }

  if (Object.keys(attributes).length > 0) {
    node.attributes = attributes;
  }

  // Parse children
  if (nodeData && typeof nodeData === "object") {
    const children: TreeNode[] = [];

    for (const [childKey, childValue] of Object.entries(nodeData)) {
      if (!childKey.startsWith("@_")) {
        if (Array.isArray(childValue)) {
          // Multiple children of the same type
          for (const childData of childValue) {
            children.push(parseTreeNode(childKey, childData, context));
          }
        } else if (typeof childValue === "object") {
          // Single child
          children.push(parseTreeNode(childKey, childValue, context));
        }
      }
    }

    // Marmot: hang the content of the sub-tree below its SubTree node. _fullpath (written by
    // BT::WriteTreeToXML) tells which instance; without it, the tree with the same ID.
    if (nodeName === "SubTree" && context) {
      const fullpath = nodeData["@__fullpath"];
      const block =
        fullpath !== undefined
          ? context.blocksByPath.get(String(fullpath))
          : context.blocksById.get(String(nodeData["@_ID"]));
      if (block !== undefined && !context.open.has(block)) {
        const parent = context.current;
        children.push(parseTreeBlock(block, context, parent?.fullpath, (parent?.depth ?? 0) + 1));
      }
    }

    // Marmot: the XML parser groups children by tag (all SetPistons, then all SetGripperRear, …).
    // BT.CPP numbers the nodes in document order, so _uid restores the order of the file.
    if (children.every((child) => uidNumber(child) !== undefined)) {
      children.sort((a, b) => uidNumber(a)! - uidNumber(b)!);
    }

    if (children.length > 0) {
      node.children = children;
    }
  }

  return node;
}

function getModelType(nodeType: string): ModelTypes {
  const typeMap: { [key: string]: ModelTypes } = {
    Action: ModelTypes.ACTION,
    Condition: ModelTypes.CONDITION,
    Decorator: ModelTypes.DECORATOR,
    Control: ModelTypes.CONTROL,
    SubTree: ModelTypes.SUBTREE,
  };

  return typeMap[nodeType] || ModelTypes.ACTION;
}

function getPortDirection(portType: string): PortDirection {
  const directionMap: { [key: string]: PortDirection } = {
    input_port: PortDirection.INPUT,
    output_port: PortDirection.OUTPUT,
    inout_port: PortDirection.INOUT,
  };

  return directionMap[portType] || PortDirection.INPUT;
}
