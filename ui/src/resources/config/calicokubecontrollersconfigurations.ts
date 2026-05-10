import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoKubeControllersConfigurationsConfig: ResourceConfig = shared.calicoResourceConfig({ plural: "kubecontrollersconfigurations", path: "/networks/calico/kube-controllers-configurations", title: "Calico Kube Controllers Configurations", subtitle: "Manage Calico KubeControllersConfiguration resources", kind: "KubeControllersConfiguration", buildSpec: () => ({}) });
