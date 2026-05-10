import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumBGPNodeConfigOverridesConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumbgpnodeconfigoverrides", path: "/networks/cilium/bgp-node-config-overrides", title: "Cilium BGP Node Config Overrides", subtitle: "Manage Cilium BGP node override resources", kind: "CiliumBGPNodeConfigOverride", buildSpec: () => ({}), statusPath: ["status", "conditions", "0", "type"] });
