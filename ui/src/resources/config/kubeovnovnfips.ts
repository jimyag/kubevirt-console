import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnOvnFipsConfig: ResourceConfig = shared.kubeOvnResourceConfig({
    plural: "ovn-fips",
    path: "/networks/kube-ovn/ovn-fips",
    title: "Kube-OVN OVN FIPs",
    subtitle: "Manage Kube-OVN OvnFip resources",
    kind: "OvnFip",
    createFields: [
      { name: "ovnEip", label: "OVN EIP", section: "FIP", defaultValue: "example-ovn-eip" },
      { name: "ipName", label: "IP Name", section: "FIP", defaultValue: "example-ip" },
      { name: "type", label: "Type", section: "FIP", defaultValue: "", placeholder: "optional" },
    ],
    buildSpec: (values) => ({ ovnEip: shared.stringValue(values.ovnEip), ipName: shared.stringValue(values.ipName), ...(shared.stringValue(values.type) ? { type: shared.stringValue(values.type) } : {}) }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "OVN EIP", value: (r) => String(shared.getRecord(r.spec).ovnEip || "N/A") }],
  });
