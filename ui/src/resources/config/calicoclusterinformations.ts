import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoClusterInformationsConfig: ResourceConfig = shared.calicoResourceConfig({ plural: "clusterinformations", path: "/networks/calico/cluster-informations", title: "Calico Cluster Information", subtitle: "Inspect Calico ClusterInformation resources", kind: "ClusterInformation", allowCreate: false, allowDelete: false, statusPath: ["spec", "calicoVersion"] });
