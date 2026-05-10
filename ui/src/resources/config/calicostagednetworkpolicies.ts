import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoStagedNetworkPoliciesConfig: ResourceConfig = shared.calicoResourceConfig({
    plural: "stagednetworkpolicies",
    path: "/networks/calico/staged-network-policies",
    title: "Calico Staged Network Policies",
    subtitle: "Manage namespaced Calico staged NetworkPolicy resources",
    kind: "StagedNetworkPolicy",
    namespaced: true,
    createFields: [{ name: "selector", label: "Selector", section: "Policy", defaultValue: "all()" }, { name: "types", label: "Types", section: "Policy", defaultValue: "Ingress" }],
    buildSpec: (values) => ({ selector: shared.stringValue(values.selector, "all()"), types: [shared.stringValue(values.types, "Ingress")] }),
    statusPath: ["spec", "selector"],
  });
