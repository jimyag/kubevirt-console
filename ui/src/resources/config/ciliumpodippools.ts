import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumPodIPPoolsConfig: ResourceConfig = shared.ciliumResourceConfig({ version: "v2alpha1", plural: "ciliumpodippools", path: "/networks/cilium/pod-ip-pools", title: "Cilium Pod IP Pools", subtitle: "Manage CiliumPodIPPool resources", kind: "CiliumPodIPPool", createFields: [{ name: "cidrs", label: "CIDRs", section: "Pool", defaultValue: "10.10.0.0/16", placeholder: "comma-separated CIDRs" }], buildSpec: (values) => ({ ipv4: { cidrs: shared.csvList(values.cidrs) } }), statusPath: ["status", "conditions", "0", "type"] });
