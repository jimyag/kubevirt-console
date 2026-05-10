import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnOvnSnatRulesConfig: ResourceConfig = shared.kubeOvnResourceConfig({
    plural: "ovn-snat-rules",
    path: "/networks/kube-ovn/ovn-snat-rules",
    title: "Kube-OVN OVN SNAT Rules",
    subtitle: "Manage Kube-OVN OvnSnatRule resources",
    kind: "OvnSnatRule",
    createFields: [
      { name: "eip", label: "OVN EIP", section: "SNAT", defaultValue: "example-ovn-eip" },
      { name: "vpcSubnet", label: "VPC Subnet", section: "SNAT", defaultValue: "10.16.0.0/24" },
    ],
    buildSpec: (values) => ({ eip: shared.stringValue(values.eip), vpcSubnet: shared.stringValue(values.vpcSubnet) }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "EIP", value: (r) => String(shared.getRecord(r.spec).eip || "N/A") }],
  });
