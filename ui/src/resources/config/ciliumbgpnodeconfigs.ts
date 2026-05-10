import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumBGPNodeConfigsConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumbgpnodeconfigs", path: "/networks/cilium/bgp-node-configs", title: "Cilium BGP Node Configs", subtitle: "Inspect Cilium BGP node config resources", kind: "CiliumBGPNodeConfig", allowCreate: false, allowDelete: false, statusPath: ["status", "conditions", "0", "type"] });
