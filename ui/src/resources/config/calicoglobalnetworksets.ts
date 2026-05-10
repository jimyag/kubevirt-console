import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoGlobalNetworkSetsConfig: ResourceConfig = shared.calicoResourceConfig({
    plural: "globalnetworksets",
    path: "/networks/calico/global-network-sets",
    title: "Calico Global Network Sets",
    subtitle: "Manage cluster-scoped Calico GlobalNetworkSet CIDR groups",
    kind: "GlobalNetworkSet",
    createFields: [{ name: "nets", label: "CIDRs", section: "Networks", defaultValue: "10.0.0.0/8", placeholder: "comma-separated CIDRs" }],
    buildSpec: (values) => ({ nets: shared.csvList(values.nets) }),
    statusPath: ["spec", "nets", "0"],
    extraColumns: [{ label: "CIDRs", value: (r) => ((shared.getRecord(r.spec).nets as string[] | undefined) || []).join(", ") || "N/A" }],
  });
