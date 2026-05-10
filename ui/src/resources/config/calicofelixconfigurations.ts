import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const calicoFelixConfigurationsConfig: ResourceConfig = shared.calicoResourceConfig({ plural: "felixconfigurations", path: "/networks/calico/felix-configurations", title: "Calico Felix Configurations", subtitle: "Manage Calico FelixConfiguration resources", kind: "FelixConfiguration", buildSpec: () => ({}) });
