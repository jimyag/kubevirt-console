import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnEvpnConfsConfig: ResourceConfig = shared.kubeOvnResourceConfig({ plural: "evpn-confs", path: "/networks/kube-ovn/evpn-confs", title: "Kube-OVN EVPN Configs", subtitle: "Manage Kube-OVN EvpnConf resources", kind: "EvpnConf", buildSpec: () => ({}), statusPath: ["status", "active"] });
