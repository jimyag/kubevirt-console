import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumClusterwideEnvoyConfigsConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumclusterwideenvoyconfigs", path: "/networks/cilium/clusterwide-envoy-configs", title: "Cilium Clusterwide Envoy Configs", subtitle: "Manage cluster-scoped CiliumClusterwideEnvoyConfig resources", kind: "CiliumClusterwideEnvoyConfig", buildSpec: () => ({ resources: [] }), statusPath: ["status", "conditions", "0", "type"] });
