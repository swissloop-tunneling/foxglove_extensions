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

// Library of behaviour tree files: a std_msgs/String with JSON {"<path>": "<xml>"} (in Project
// Marmot published by tbm_mission on /behavior_tree_library). A file is shown as a tree with its
// <include> files resolved. Raw files have no _uid (BT.CPP assigns them when it loads a tree), so
// nodes get one here in document order, which the parser needs for the order of the children.
import { parseBehaviorTreeXML } from "./parse";
import { TBehaviorTree, TreeNode } from "./types";

export type LibraryFile = { path: string; xml: string };

export function parseLibrary(json?: string): LibraryFile[] {
  if (!json) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed == undefined || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [];
    }
    return Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([path, xml]) => ({ path, xml }))
      .sort((a, b) => a.path.localeCompare(b.path));
  } catch {
    return [];
  }
}

const BEHAVIOR_TREE_BLOCK = /<BehaviorTree\b[^>]*>[\s\S]*?<\/BehaviorTree>/g;
const INCLUDE = /<include\s+[^>]*\bpath\s*=\s*"([^"]+)"[^>]*\/?>/g;
const BLOCK_ID = /^<BehaviorTree\b[^>]*\bID\s*=\s*"([^"]*)"/;

function blocksOf(xml: string): string[] {
  return xml.match(BEHAVIOR_TREE_BLOCK) ?? [];
}

/** ID of the main tree of a file: main_tree_to_execute, otherwise the first <BehaviorTree>. */
export function mainTreeId(xml: string): string | undefined {
  const main = /<root\b[^>]*\bmain_tree_to_execute\s*=\s*"([^"]*)"/.exec(xml)?.[1];
  return main ?? BLOCK_ID.exec(blocksOf(xml)[0] ?? "")?.[1];
}

/** Path of an <include> relative to the including file, e.g. "test_trees/inchwormCycle.xml". */
function resolvePath(fromPath: string, includePath: string): string {
  const parts = fromPath.split("/").slice(0, -1);
  for (const part of includePath.split("/")) {
    if (part === "..") {
      parts.pop();
    } else if (part !== "." && part !== "") {
      parts.push(part);
    }
  }
  return parts.join("/");
}

/** The <BehaviorTree> blocks of a file and of everything it includes, main tree first. */
export function collectBlocks(path: string, files: readonly LibraryFile[]): string[] {
  const byPath = new Map(files.map((file) => [file.path, file.xml]));
  const blocks: string[] = [];
  const ids = new Set<string>();
  const visited = new Set<string>();

  const visit = (filePath: string) => {
    const xml = byPath.get(filePath);
    if (xml === undefined || visited.has(filePath)) {
      return;
    }
    visited.add(filePath);
    for (const block of blocksOf(xml)) {
      const id = BLOCK_ID.exec(block)?.[1] ?? "";
      if (!ids.has(id)) {
        ids.add(id);
        blocks.push(block);
      }
    }
    for (const match of xml.matchAll(INCLUDE)) {
      visit(resolvePath(filePath, match[1]!));
    }
  };
  visit(path);

  // The main tree of the file first, as BT::WriteTreeToXML writes it
  const mainId = mainTreeId(byPath.get(path) ?? "");
  const mainIndex = blocks.findIndex((block) => BLOCK_ID.exec(block)?.[1] === mainId);
  if (mainIndex > 0) {
    blocks.unshift(...blocks.splice(mainIndex, 1));
  }
  return blocks;
}

/** Gives every node tag inside the blocks a _uid in document order (keeps existing ones). */
function numberNodes(blocks: readonly string[]): string[] {
  let uid = 0;
  return blocks.map((block) =>
    block.replace(
      /<([A-Za-z_][\w.-]*)(\s[^<>]*?)?(\/?)>/g,
      (tag, name: string, attrs = "", end) => {
        const attributes = attrs as string;
        if (name === "BehaviorTree" || /\b_uid\s*=/.test(attributes)) {
          return tag;
        }
        uid += 1;
        // Like BT.CPP: a node without a name is named after its type (a SubTree shows its ID)
        const label =
          name !== "SubTree" && !/(^|\s)name\s*=/.test(attributes) ? ` name="${name}"` : "";
        return `<${name}${attributes}${label} _uid="${uid}"${end as string}>`;
      },
    ),
  );
}

/** Ids that are unique in the graph, also when a sub-tree is used more than once. */
function uniqueIds(node: TreeNode, counter = { next: 0 }): TreeNode {
  counter.next += 1;
  return {
    ...node,
    id: `library-${counter.next}`,
    children: node.children?.map((child) => uniqueIds(child, counter)),
  };
}

/** The tree of a library file with its sub-trees, ready for the graph (no live state). */
export function libraryTree(path: string, files: readonly LibraryFile[]): TBehaviorTree | null {
  const blocks = collectBlocks(path, files);
  if (blocks.length === 0) {
    return null;
  }
  const xml = `<root BTCPP_format="4">\n${numberNodes(blocks).join("\n")}\n</root>`;
  try {
    const tree = parseBehaviorTreeXML(xml);
    return { ...tree, root: uniqueIds(tree.root) };
  } catch (error) {
    console.error(`Failed to parse library file ${path}:`, error);
    return null;
  }
}
