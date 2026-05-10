import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoNetworkSetsConfig: ResourceConfig = shared.calicoResourceConfig({
    plural: "networksets",
    path: "/networks/calico/network-sets",
    title: "Calico Network Sets",
    subtitle: "Manage namespaced Calico NetworkSet CIDR groups",
    kind: "NetworkSet",
    namespaced: true,
    createFields: [{ name: "nets", label: "CIDRs", section: "Networks", defaultValue: "10.0.0.0/8", placeholder: "comma-separated CIDRs" }],
    buildSpec: (values) => ({ nets: shared.csvList(values.nets) }),
    statusPath: ["spec", "nets", "0"],
    extraColumns: [{ label: "CIDRs", value: (r) => ((shared.getRecord(r.spec).nets as string[] | undefined) || []).join(", ") || "N/A" }],
  });
