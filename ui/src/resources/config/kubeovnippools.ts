import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnIPPoolsConfig: ResourceConfig = shared.kubeOvnResourceConfig({
    plural: "ippools",
    path: "/networks/kube-ovn/ip-pools",
    title: "Kube-OVN IP Pools",
    subtitle: "Manage Kube-OVN IPPool resources",
    kind: "IPPool",
    createFields: [
      { name: "subnet", label: "Subnet", section: "IP Pool", defaultValue: "example-subnet" },
      { name: "ips", label: "IPs", section: "IP Pool", defaultValue: "", placeholder: "comma separated" },
    ],
    buildSpec: (values) => ({ subnet: shared.stringValue(values.subnet), ips: shared.csvList(values.ips) }),
    statusPath: ["spec", "subnet"],
    extraColumns: [{ label: "Subnet", value: (r) => String(shared.getRecord(r.spec).subnet || "N/A") }],
  });
