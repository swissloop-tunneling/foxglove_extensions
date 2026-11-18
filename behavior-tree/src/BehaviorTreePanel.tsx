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
// Modified by Swissloop Tunneling (Project Marmot): operator controls (goal, start, stop and the
// state of the mission node) and the blackboard of the running tree. All additions are marked
// with "Marmot".
import { PanelExtensionContext, SettingsTreeAction, Topic } from "@foxglove/extension";
import {
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";

import { BehaviorTree } from "./BehaviorTree";
import { ControlBar, Goal } from "./components/ControlBar";
import {
  applyBehaviorTreeLogs,
  EMPTY_NODE_STATUS_SNAPSHOT,
  extractBehaviorTreeLog,
} from "./liveState";
import "./styles/globals.css";
import { BehaviorTreeLog, NodeStatusSnapshot } from "./types";

type PanelState = {
  behaviorTreeXmlTopic?: string;
  behaviorTreeLogsTopic?: string;
  // Marmot: operator controls and blackboard ("" switches one off)
  goalTopic?: string;
  startService?: string;
  stopService?: string;
  statusTopic?: string;
  stepTopic?: string;
  blackboardTopic?: string;
  libraryTopic?: string;
};

// Marmot: defaults for Project Marmot (bt_runner_node and tbm_mission)
const MARMOT_DEFAULTS = {
  behaviorTreeXmlTopic: "/behavior_tree_xml",
  behaviorTreeLogsTopic: "/behavior_tree_log",
  goalTopic: "/tbm/goal",
  startService: "/tbm/start",
  stopService: "/tbm/stop",
  statusTopic: "/tbm/status",
  stepTopic: "/tbm/bt_step",
  blackboardTopic: "/behavior_tree_blackboard",
  libraryTopic: "/behavior_tree_library",
} satisfies Required<PanelState>;
const GOAL_SCHEMA = "geometry_msgs/msg/Point";

/** Text of a std_msgs/String message (or a plain string) */
function stringData(message: unknown): string | undefined {
  if (typeof message === "string") {
    return message;
  }
  if (message != null && typeof message === "object" && "data" in message) {
    const data = (message as { data?: unknown }).data;
    return typeof data === "string" ? data : undefined;
  }
  return undefined;
}

/** Latest String data of a topic in the current frame */
function latestString(
  frame: readonly { topic: string; message: unknown }[] | undefined,
  topic: string,
): string | undefined {
  if (!frame || !topic) {
    return undefined;
  }
  for (let i = frame.length - 1; i >= 0; i--) {
    const event = frame[i];
    if (event?.topic === topic) {
      return stringData(event.message);
    }
  }
  return undefined;
}

const BEHAVIOR_TREE_XML_TOPIC_SCHEMA = "std_msgs/msg/String";
const BEHAVIOR_TREE_LOGS_TOPIC_SCHEMA = "nav2_msgs/msg/BehaviorTreeLog";

function BehaviorTreePanel({ context }: { context: PanelExtensionContext }): ReactElement {
  const [panelState, setPanelState] = useState<PanelState>(() => {
    // Marmot: unset entries take the Project Marmot defaults
    return { ...MARMOT_DEFAULTS, ...((context.initialState as PanelState | undefined) ?? {}) };
  });
  const config = { ...MARMOT_DEFAULTS, ...panelState };

  // Marmot: state of the mission node, blackboard and the answer of the last button
  const [missionStatus, setMissionStatus] = useState<string | undefined>();
  const [missionStep, setMissionStep] = useState<string | undefined>();
  const [blackboardJson, setBlackboardJson] = useState<string | undefined>();
  const [libraryJson, setLibraryJson] = useState<string | undefined>();
  const [feedback, setFeedback] = useState<string | undefined>();

  // const [behaviorTreeXmlTopic, setBehaviorTreeXmlTopic] = useState<string | undefined>(
  // panelState.behaviorTreeXmlTopic,
  // );
  // const [behaviorTreeLogsTopic, setBehaviorTreeLogsTopic] = useState<string | undefined>(
  // panelState.behaviorTreeLogsTopic,
  // );
  const [behaviorTreeXml, setBehaviorTreeXml] = useState<string | undefined>();
  const [nodeStatuses, setNodeStatuses] = useState<NodeStatusSnapshot>(EMPTY_NODE_STATUS_SNAPSHOT);
  const behaviorTreeXmlRef = useRef<string | undefined>(undefined);

  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  const [topics, setTopics] = useState<Topic[]>([]);

  const validBehaviorTreeXmlTopics = useMemo(
    () =>
      topics
        .filter((topic) => topic.schemaName === BEHAVIOR_TREE_XML_TOPIC_SCHEMA)
        .map((topic) => topic.name),
    [topics],
  );

  const validBehaviorTreeLogsTopics = useMemo(
    () =>
      topics
        .filter((topic) => topic.schemaName === BEHAVIOR_TREE_LOGS_TOPIC_SCHEMA)
        .map((topic) => topic.name),
    [topics],
  );

  useLayoutEffect(() => {
    behaviorTreeXmlRef.current = undefined;
    setBehaviorTreeXml(undefined);
  }, [panelState.behaviorTreeXmlTopic]);

  useLayoutEffect(() => {
    setNodeStatuses(EMPTY_NODE_STATUS_SNAPSHOT);
  }, [panelState.behaviorTreeXmlTopic, panelState.behaviorTreeLogsTopic]);

  // We use a layout effect to setup render handling for our panel. We also setup some topic subscriptions.
  useLayoutEffect(() => {
    // After adding a render handler, you must indicate which fields from RenderState will trigger updates.
    // If you do not watch any fields then your panel will never render since the panel context will assume you do not want any updates.

    // tell the panel context that we care about any update to the _topic_ field of RenderState
    context.watch("topics");

    // tell the panel context we want messages for the current frame for topics we've subscribed to
    // This corresponds to the _currentFrame_ field of render state.
    context.watch("currentFrame");
    context.watch("didSeek");

    // The render handler is run by the broader Foxglove system during playback when your panel
    // needs to render because the fields it is watching have changed. How you handle rendering depends on your framework.
    // You can only setup one render handler - usually early on in setting up your panel.
    //
    // Without a render handler your panel will never receive updates.
    //
    // The render handler could be invoked as often as 60hz during playback if fields are changing often.
    context.onRender = (renderState, done) => {
      // render functions receive a _done_ callback. You MUST call this callback to indicate your panel has finished rendering.
      // Your panel will not receive another render callback until _done_ is called from a prior render. If your panel is not done
      // rendering before the next render call, Foxglove shows a notification to the user that your panel is delayed.
      //
      // Set the done callback into a state variable to trigger a re-render.
      setRenderDone(() => done);
      if (renderState.topics != null) {
        setTopics(renderState.topics as Topic[]);
      }

      // Clear accumulated live state when Foxglove seeks to a different time.
      let shouldResetStatuses = renderState.didSeek === true;

      // Process messages from the subscribed topic
      if (panelState.behaviorTreeXmlTopic && renderState.currentFrame) {
        const messages = renderState.currentFrame.filter(
          (msg) => msg.topic === panelState.behaviorTreeXmlTopic,
        );

        if (messages.length > 0) {
          const latestMessage = messages[messages.length - 1];

          if (latestMessage?.message) {
            let xmlData: string | undefined;

            if (typeof latestMessage.message === "string") {
              xmlData = latestMessage.message;
            } else if (
              typeof latestMessage.message === "object" &&
              "data" in latestMessage.message
            ) {
              xmlData = (latestMessage.message as { data?: string }).data;
            }

            if (xmlData && typeof xmlData === "string" && xmlData !== behaviorTreeXmlRef.current) {
              // A different tree replaced the loaded one: clear stale live state.
              if (behaviorTreeXmlRef.current !== undefined) {
                shouldResetStatuses = true;
              }
              behaviorTreeXmlRef.current = xmlData;
              setBehaviorTreeXml(xmlData);
            }
          }
        }
      }

      // Marmot: mission state and blackboard (std_msgs/String)
      const status = latestString(renderState.currentFrame, config.statusTopic);
      if (status != undefined) {
        setMissionStatus(status);
      }
      const step = latestString(renderState.currentFrame, config.stepTopic);
      if (step != undefined) {
        setMissionStep(step);
      }
      const blackboard = latestString(renderState.currentFrame, config.blackboardTopic);
      if (blackboard != undefined) {
        setBlackboardJson(blackboard);
      }
      const library = latestString(renderState.currentFrame, config.libraryTopic);
      if (library != undefined) {
        setLibraryJson(library);
      }

      const logsToApply: BehaviorTreeLog[] = [];
      if (panelState.behaviorTreeLogsTopic && renderState.currentFrame) {
        const messages = renderState.currentFrame.filter(
          (msg) => msg.topic === panelState.behaviorTreeLogsTopic,
        );

        for (const message of messages) {
          const logData = extractBehaviorTreeLog(message.message);
          if (logData) {
            logsToApply.push(logData);
          }
        }
      }

      if (shouldResetStatuses || logsToApply.length > 0) {
        setNodeStatuses((previous) =>
          applyBehaviorTreeLogs(
            shouldResetStatuses ? EMPTY_NODE_STATUS_SNAPSHOT : previous,
            logsToApply,
          ),
        );
      }
    };
  }, [
    context,
    panelState,
    config.statusTopic,
    config.stepTopic,
    config.blackboardTopic,
    config.libraryTopic,
  ]);

  // Handle topic subscriptions in a separate effect that runs when topics change
  useEffect(() => {
    const subscriptions = [];

    if (panelState.behaviorTreeXmlTopic) {
      subscriptions.push({ topic: panelState.behaviorTreeXmlTopic });
    }

    if (panelState.behaviorTreeLogsTopic) {
      subscriptions.push({ topic: panelState.behaviorTreeLogsTopic });
    }

    // Marmot
    for (const topic of [
      config.statusTopic,
      config.stepTopic,
      config.blackboardTopic,
      config.libraryTopic,
    ]) {
      if (topic) {
        subscriptions.push({ topic });
      }
    }

    if (subscriptions.length > 0) {
      context.subscribe(subscriptions);
    } else {
      // Subscribe to empty array to clear previous subscriptions
      context.subscribe([]);
    }
  }, [
    context,
    panelState.behaviorTreeXmlTopic,
    panelState.behaviorTreeLogsTopic,
    config.statusTopic,
    config.stepTopic,
    config.blackboardTopic,
    config.libraryTopic,
  ]);

  // Marmot: advertise the goal topic while the panel is open, so the first goal is not lost
  useEffect(() => {
    const topic = config.goalTopic;
    if (!topic || !context.advertise) {
      return undefined;
    }
    context.advertise(topic, GOAL_SCHEMA);
    return () => {
      context.unadvertise?.(topic);
    };
  }, [context, config.goalTopic]);

  const setGoal = useCallback(
    (goal: Goal) => {
      try {
        context.publish?.(config.goalTopic, goal);
        setFeedback(`goal sent: forward ${goal.x}, left ${goal.y}, up ${goal.z} mm`);
      } catch (error) {
        setFeedback(`cannot send the goal: ${String(error)}`);
      }
    },
    [context, config.goalTopic],
  );

  const callTrigger = useCallback(
    (service: string) => {
      if (!context.callService || !service) {
        setFeedback("the connection does not support service calls");
        return;
      }
      context
        .callService(service, {})
        .then((response) => {
          const { success, message } = (response ?? {}) as { success?: boolean; message?: string };
          const result = success === false ? "refused" : "ok";
          setFeedback(`${service}: ${result}${message ? `, ${message}` : ""}`);
        })
        .catch((error: unknown) => {
          setFeedback(`${service} failed: ${String(error)}`);
        });
    },
    [context],
  );

  // Setup panel settings
  useEffect(() => {
    const actionHandler = (action: SettingsTreeAction) => {
      const path = action.payload.path.join(".");
      if (action.action === "update" && path === "behaviorTreeTopics.behaviorTreeXmlTopic") {
        const newTopic = action.payload.value as string;
        setPanelState((prev) => ({ ...prev, behaviorTreeXmlTopic: newTopic }));
      }
      if (action.action === "update" && path === "behaviorTreeTopics.behaviorTreeLogsTopic") {
        const newTopic = action.payload.value as string;
        setPanelState((prev) => ({ ...prev, behaviorTreeLogsTopic: newTopic }));
      }
      // Marmot
      const [node, field] = action.payload.path;
      if (action.action === "update" && node === "marmot" && field && field in MARMOT_DEFAULTS) {
        const value = (action.payload.value as string | undefined) ?? "";
        setPanelState((prev) => ({ ...prev, [field]: value }));
      }
    };

    context.updatePanelSettingsEditor({
      actionHandler,
      nodes: {
        behaviorTreeTopics: {
          label: "Behavior Tree Topics",
          fields: {
            behaviorTreeXmlTopic: {
              label: "Behavior Tree XML Topic",
              input: "autocomplete",
              value: panelState.behaviorTreeXmlTopic ?? "",
              items: validBehaviorTreeXmlTopics,
            },
            behaviorTreeLogsTopic: {
              label: "Behavior Tree Logs Topic",
              input: "autocomplete",
              value: panelState.behaviorTreeLogsTopic ?? "",
              items: validBehaviorTreeLogsTopics,
            },
          },
        },
        // Marmot
        marmot: {
          label: "Operator Controls (Project Marmot)",
          fields: {
            goalTopic: { label: "Goal topic (Point)", input: "string", value: config.goalTopic },
            startService: {
              label: "Start service (Trigger)",
              input: "string",
              value: config.startService,
            },
            stopService: {
              label: "Stop service (Trigger)",
              input: "string",
              value: config.stopService,
            },
            statusTopic: {
              label: "Status topic (String)",
              input: "string",
              value: config.statusTopic,
            },
            stepTopic: { label: "Step topic (String)", input: "string", value: config.stepTopic },
            blackboardTopic: {
              label: "Blackboard topic (String, JSON)",
              input: "string",
              value: config.blackboardTopic,
            },
            libraryTopic: {
              label: "Tree library topic (String, JSON)",
              input: "string",
              value: config.libraryTopic,
            },
          },
        },
      },
    });
  }, [
    context,
    panelState.behaviorTreeXmlTopic,
    panelState.behaviorTreeLogsTopic,
    validBehaviorTreeXmlTopics,
    validBehaviorTreeLogsTopics,
    config.goalTopic,
    config.startService,
    config.stopService,
    config.statusTopic,
    config.stepTopic,
    config.blackboardTopic,
    config.libraryTopic,
  ]);

  // Save panel state
  useEffect(() => {
    context.saveState(panelState);
  }, [context, panelState]);

  // invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  return (
    // There is a bug with Foxglove's `renderState.colorScheme` prop where it doesn't update properly.
    <div className="h-full w-full dark flex flex-col">
      {/* Marmot: operator controls */}
      <ControlBar
        canPublish={context.publish != null && config.goalTopic !== ""}
        canCallServices={context.callService != null}
        status={missionStatus}
        step={missionStep}
        feedback={feedback}
        onSetGoal={setGoal}
        onStart={() => {
          callTrigger(config.startService);
        }}
        onStop={() => {
          callTrigger(config.stopService);
        }}
      />
      <div className="flex-1 min-h-0">
        <BehaviorTree
          xml={behaviorTreeXml}
          nodeStatuses={nodeStatuses}
          blackboardJson={blackboardJson}
          libraryJson={libraryJson}
        />
      </div>
    </div>
  );
}

export function initBehaviorTreePanel(context: PanelExtensionContext): () => void {
  const root = createRoot(context.panelElement);
  root.render(<BehaviorTreePanel context={context} />);

  // Return a function to run when the panel is removed
  return () => {
    root.unmount();
  };
}
