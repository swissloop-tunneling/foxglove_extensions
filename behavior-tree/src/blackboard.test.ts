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

import { parseBlackboard } from "./components/BlackboardView";

describe("parseBlackboard", () => {
  it("reads the JSON of bt_runner_node", () => {
    const json =
      '{"InchwormToGoal":{"extend_p1":"5.000000","goal_reached":1},"InchwormCycle::6":{"curr_p1":"0.35"}}';
    expect(parseBlackboard(json)).toEqual({
      InchwormToGoal: { extend_p1: "5.000000", goal_reached: 1 },
      "InchwormCycle::6": { curr_p1: "0.35" },
    });
  });

  it("skips entries that are no objects", () => {
    expect(parseBlackboard('{"A":null,"B":3,"C":{"k":"v"}}')).toEqual({ C: { k: "v" } });
  });

  it("returns undefined for missing or broken data", () => {
    expect(parseBlackboard(undefined)).toBeUndefined();
    expect(parseBlackboard("")).toBeUndefined();
    expect(parseBlackboard("{not json")).toBeUndefined();
    expect(parseBlackboard("[1,2]")).toBeUndefined();
  });
});
