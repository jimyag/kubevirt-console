import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumEnvoyConfigsConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumenvoyconfigs", path: "/networks/cilium/envoy-configs", title: "Cilium Envoy Configs", subtitle: "Manage namespaced CiliumEnvoyConfig resources", kind: "CiliumEnvoyConfig", namespaced: true, buildSpec: () => ({ resources: [] }), statusPath: ["status", "conditions", "0", "type"] });
