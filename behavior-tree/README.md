# Behavior Tree Panel (Project Marmot fork)

Fork of the [Polymath Robotics behavior-tree panel](https://github.com/polymathrobotics/foxglove_extensions/tree/main/behavior-tree)
(Apache-2.0) for Project Marmot. It shows up in Foxglove as **[Marmot] Behavior Tree** and adds:

- **Operator controls** above the tree: goal (forward, left, up in mm) sent as `geometry_msgs/msg/Point`,
  **Start** and **Stop** buttons calling `std_srvs/srv/Trigger` services, and the state of the mission node.
- **Blackboard** tab in the sidebar: the values of the running tree, from a `std_msgs/msg/String` with
  the JSON of `BT::ExportTreeToJSON`.

Defaults (all changeable in the panel settings under "Operator Controls (Project Marmot)"):

| Setting | Default | Published by |
|---|---|---|
| Behavior Tree XML / Logs | `/behavior_tree_xml`, `/behavior_tree_log` | `bt_runner_node` |
| Blackboard | `/behavior_tree_blackboard` | `bt_runner_node` |
| Goal topic | `/tbm/goal` | this panel, read by `tbm_mission` |
| Start / Stop services | `/tbm/start`, `/tbm/stop` | `tbm_mission` |
| Status / step topics | `/tbm/status`, `/tbm/bt_step` | `tbm_mission` |

Build: `npm ci`, `npm run package`, then drag `swisslooptunneling.marmot-behavior-tree-0.3.0.foxe`
into Foxglove. Changes to the original code are marked with "Marmot".

---

# Behavior Tree Panel

![Behavior Tree](./docs/behavior_tree_first_pass.gif)

This panel visualizes BehaviorTree.CPP trees and their live node states. The tree is loaded from a `std_msgs/msg/String` XML topic, and status changes are loaded from a `nav2_msgs/msg/BehaviorTreeLog` topic.

## How to Use

In order to visualize your behavior tree, you'll need to publish a topic of type `std_msgs/msg/String` that is an XML string of your tree. Example:

```cpp
std_msgs::msg::String bt_xml_msg;
bt_xml_msg.data = BT::WriteTreeToXML(tree_, true, true);
```

The second argument of `BT::WriteTreeToXML` defines whether to include BehaviorTree.CPP metadata such as each node's `_uid`. The panel uses that UID to associate `BehaviorTreeStatusChange.uid` values with graph nodes. Node-name matching is used only as a fallback for uniquely named nodes.

Publish or record `nav2_msgs/msg/BehaviorTreeLog` messages from the same tree. Nav2's `RosTopicLogger` publishes these messages on `behavior_tree_log` by default.

In the Foxglove panel settings, select:

1. **Behavior Tree XML Topic** - the `std_msgs/msg/String` topic containing the XML.
2. **Behavior Tree Logs Topic** - the `nav2_msgs/msg/BehaviorTreeLog` topic containing transitions.

Live status colors are:

- Gray: `IDLE`
- Amber and pulsing: `RUNNING`
- Green: `SUCCESS`
- Red: `FAILURE`
- Slate: `SKIPPED`

The panel clears accumulated status when Foxglove seeks, when the selected topics change, or when a different tree XML document replaces the loaded tree. This prevents state from the prior source or tree from remaining visible.
