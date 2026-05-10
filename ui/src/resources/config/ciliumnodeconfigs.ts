import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumNodeConfigsConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumnodeconfigs", path: "/networks/cilium/node-configs", title: "Cilium Node Configs", subtitle: "Manage namespaced CiliumNodeConfig resources", kind: "CiliumNodeConfig", namespaced: true, buildSpec: () => ({ defaults: {} }), statusPath: ["status", "conditions", "0", "type"] });
