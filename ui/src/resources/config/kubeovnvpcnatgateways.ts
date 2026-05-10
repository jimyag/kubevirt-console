import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnVpcNatGatewaysConfig: ResourceConfig = shared.kubeOvnResourceConfig({
    plural: "vpc-nat-gateways",
    path: "/networks/kube-ovn/vpc-nat-gateways",
    title: "Kube-OVN VPC NAT Gateways",
    subtitle: "Manage Kube-OVN VpcNatGateway resources",
    kind: "VpcNatGateway",
    createFields: [
      { name: "namespace", label: "Workload Namespace", section: "Gateway", defaultValue: "default" },
      { name: "vpc", label: "VPC", section: "Gateway", defaultValue: "ovn-cluster" },
      { name: "subnet", label: "Subnet", section: "Gateway", defaultValue: "example-subnet" },
      { name: "lanIp", label: "LAN IP", section: "Gateway", defaultValue: "", placeholder: "optional" },
      { name: "externalSubnets", label: "External Subnets", section: "Gateway", defaultValue: "", placeholder: "comma separated" },
      { name: "replicas", label: "Replicas", section: "Gateway", type: "number", defaultValue: "1" },
    ],
    buildSpec: (values) => ({
      namespace: shared.stringValue(values.namespace, "default"),
      vpc: shared.stringValue(values.vpc, "ovn-cluster"),
      subnet: shared.stringValue(values.subnet, "example-subnet"),
      ...(shared.stringValue(values.lanIp) ? { lanIp: shared.stringValue(values.lanIp) } : {}),
      externalSubnets: shared.csvList(values.externalSubnets),
      replicas: shared.numberValue(values.replicas, 1),
    }),
    statusPath: ["status", "ready"],
    extraColumns: [
      { label: "VPC", value: (r) => String(shared.getRecord(r.spec).vpc || "N/A") },
      { label: "Subnet", value: (r) => String(shared.getRecord(r.spec).subnet || "N/A") },
    ],
  });
