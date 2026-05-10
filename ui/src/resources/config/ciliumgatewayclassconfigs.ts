import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumGatewayClassConfigsConfig: ResourceConfig = shared.ciliumResourceConfig({ version: "v2alpha1", plural: "ciliumgatewayclassconfigs", path: "/networks/cilium/gateway-class-configs", title: "Cilium Gateway Class Configs", subtitle: "Manage Cilium Gateway API class configs", kind: "CiliumGatewayClassConfig", namespaced: true, buildSpec: () => ({}), statusPath: ["status", "conditions", "0", "type"] });
