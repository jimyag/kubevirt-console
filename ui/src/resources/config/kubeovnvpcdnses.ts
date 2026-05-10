import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnVpcDnsesConfig: ResourceConfig = shared.kubeOvnResourceConfig({
    plural: "vpc-dnses",
    path: "/networks/kube-ovn/vpc-dnses",
    title: "Kube-OVN VPC DNS",
    subtitle: "Manage Kube-OVN VpcDns resources",
    kind: "VpcDns",
    createFields: [
      { name: "vpc", label: "VPC", section: "DNS", defaultValue: "ovn-cluster" },
      { name: "subnet", label: "Subnet", section: "DNS", defaultValue: "example-subnet" },
      { name: "replicas", label: "Replicas", section: "DNS", type: "number", defaultValue: "1" },
    ],
    buildSpec: (values) => ({ vpc: shared.stringValue(values.vpc), subnet: shared.stringValue(values.subnet), replicas: shared.numberValue(values.replicas, 1) }),
    statusPath: ["status", "active"],
    extraColumns: [{ label: "VPC", value: (r) => String(shared.getRecord(r.spec).vpc || "N/A") }, { label: "Subnet", value: (r) => String(shared.getRecord(r.spec).subnet || "N/A") }],
  });
