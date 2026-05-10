import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const ciliumEndpointSlicesConfig: ResourceConfig = shared.ciliumResourceConfig({ version: "v2alpha1", plural: "ciliumendpointslices", path: "/networks/cilium/endpoint-slices", title: "Cilium Endpoint Slices", subtitle: "Inspect CiliumEndpointSlice resources", kind: "CiliumEndpointSlice", allowCreate: false, allowDelete: false, statusPath: ["status", "state"] });
