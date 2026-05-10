import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumCIDRGroupsConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumcidrgroups", path: "/networks/cilium/cidr-groups", title: "Cilium CIDR Groups", subtitle: "Manage reusable Cilium CIDR groups", kind: "CiliumCIDRGroup", createFields: [{ name: "cidrs", label: "CIDRs", section: "CIDR", defaultValue: "10.0.0.0/8", placeholder: "comma-separated CIDRs" }], buildSpec: (values) => ({ externalCIDRs: shared.csvList(values.cidrs) }), statusPath: ["spec", "externalCIDRs", "0"] });
