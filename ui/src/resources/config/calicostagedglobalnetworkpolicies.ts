import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoStagedGlobalNetworkPoliciesConfig: ResourceConfig = shared.calicoResourceConfig({
    plural: "stagedglobalnetworkpolicies",
    path: "/networks/calico/staged-global-network-policies",
    title: "Calico Staged Global Policies",
    subtitle: "Manage cluster-scoped Calico staged GlobalNetworkPolicy resources",
    kind: "StagedGlobalNetworkPolicy",
    createFields: [{ name: "selector", label: "Selector", section: "Policy", defaultValue: "all()" }, { name: "order", label: "Order", section: "Policy", type: "number", defaultValue: "100" }],
    buildSpec: (values) => ({ selector: shared.stringValue(values.selector, "all()"), order: shared.numberValue(values.order, 100) }),
    statusPath: ["spec", "selector"],
  });
