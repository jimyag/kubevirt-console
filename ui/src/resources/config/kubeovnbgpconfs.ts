import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnBgpConfsConfig: ResourceConfig = shared.kubeOvnResourceConfig({ plural: "bgp-confs", path: "/networks/kube-ovn/bgp-confs", title: "Kube-OVN BGP Configs", subtitle: "Manage Kube-OVN BgpConf resources", kind: "BgpConf", buildSpec: () => ({}), statusPath: ["status", "active"] });
