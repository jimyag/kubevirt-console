import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumEndpointsConfig: ResourceConfig = shared.ciliumResourceConfig({ plural: "ciliumendpoints", path: "/networks/cilium/endpoints", title: "Cilium Endpoints", subtitle: "Inspect CiliumEndpoint workload state", kind: "CiliumEndpoint", namespaced: true, allowCreate: false, allowDelete: false, statusPath: ["status", "state"], detailSections: shared.ciliumEndpointDetailSections });
