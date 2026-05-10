import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnIptablesSnatRulesConfig: ResourceConfig = shared.kubeOvnResourceConfig({
    plural: "iptables-snat-rules",
    path: "/networks/kube-ovn/iptables-snat-rules",
    title: "Kube-OVN Iptables SNAT Rules",
    subtitle: "Manage Kube-OVN IptablesSnatRule resources",
    kind: "IptablesSnatRule",
    createFields: [
      { name: "eip", label: "EIP", section: "SNAT", defaultValue: "example-eip" },
      { name: "internalCIDR", label: "Internal CIDR", section: "SNAT", defaultValue: "10.16.0.0/24" },
    ],
    buildSpec: (values) => ({ eip: shared.stringValue(values.eip), internalCIDR: shared.stringValue(values.internalCIDR) }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "EIP", value: (r) => String(shared.getRecord(r.spec).eip || "N/A") }],
  });
