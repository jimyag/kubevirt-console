import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnIptablesFIPRulesConfig: ResourceConfig = shared.kubeOvnResourceConfig({
    plural: "iptables-fip-rules",
    path: "/networks/kube-ovn/iptables-fip-rules",
    title: "Kube-OVN Iptables FIP Rules",
    subtitle: "Manage Kube-OVN IptablesFIPRule resources",
    kind: "IptablesFIPRule",
    createFields: [
      { name: "eip", label: "EIP", section: "FIP", defaultValue: "example-eip" },
      { name: "internalIp", label: "Internal IP", section: "FIP", defaultValue: "10.16.0.10" },
    ],
    buildSpec: (values) => ({ eip: shared.stringValue(values.eip), internalIp: shared.stringValue(values.internalIp) }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "EIP", value: (r) => String(shared.getRecord(r.spec).eip || "N/A") }],
  });
