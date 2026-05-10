import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const endpointsConfig: ResourceConfig = {
    id: "endpoints",
    path: "/networks/kubernetes/endpoints",
    title: "Endpoints",
    subtitle: "Inspect Kubernetes Endpoints selected by Services",
    listPath: "/api/v1/endpoints",
    namespaced: true,
    resourcePath: "/api/v1",
    kind: "Endpoints",
    allowCreate: false,
    allowDelete: false,
    statusPath: ["subsets", "0", "addresses", "0", "ip"],
    detailSections: shared.kubernetesEndpointsDetailSections,
    extraColumns: [{ label: "Subsets", value: (r) => String((shared.getRecord(r).subsets as unknown[] | undefined)?.length || 0) }],
    createTemplate: `apiVersion: v1
kind: Endpoints
metadata:
  name: example-endpoints
  namespace: default
`,
  };
