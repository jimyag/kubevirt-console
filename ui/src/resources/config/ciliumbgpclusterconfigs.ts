import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumBGPClusterConfigsConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumbgpclusterconfigs", path: "/networks/cilium/bgp-cluster-configs", title: "Cilium BGP Cluster Configs", subtitle: "Manage Cilium BGPClusterConfig resources", kind: "CiliumBGPClusterConfig", buildSpec: () => ({ bgpInstances: [] }), statusPath: ["status", "conditions", "0", "type"] });
