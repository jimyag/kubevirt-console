import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnOvnEipsConfig: ResourceConfig = shared.kubeOvnResourceConfig({
    plural: "ovn-eips",
    path: "/networks/kube-ovn/ovn-eips",
    title: "Kube-OVN OVN EIPs",
    subtitle: "Manage Kube-OVN OvnEip resources",
    kind: "OvnEip",
    createFields: [
      { name: "externalSubnet", label: "External Subnet", section: "EIP", defaultValue: "external-subnet" },
      { name: "v4ip", label: "IPv4", section: "EIP", defaultValue: "", placeholder: "optional" },
      { name: "type", label: "Type", section: "EIP", defaultValue: "", placeholder: "optional" },
    ],
    buildSpec: (values) => ({ externalSubnet: shared.stringValue(values.externalSubnet), ...(shared.stringValue(values.v4ip) ? { v4ip: shared.stringValue(values.v4ip) } : {}), ...(shared.stringValue(values.type) ? { type: shared.stringValue(values.type) } : {}) }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "External Subnet", value: (r) => String(shared.getRecord(r.spec).externalSubnet || "N/A") }],
  });
