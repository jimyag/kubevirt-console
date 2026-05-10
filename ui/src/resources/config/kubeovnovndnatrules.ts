import type { ResourceConfig } from "@/components/resource-management";
import * as shared from "./shared";

export const kubeOvnOvnDnatRulesConfig: ResourceConfig = shared.kubeOvnResourceConfig({
    plural: "ovn-dnat-rules",
    path: "/networks/kube-ovn/ovn-dnat-rules",
    title: "Kube-OVN OVN DNAT Rules",
    subtitle: "Manage Kube-OVN OvnDnatRule resources",
    kind: "OvnDnatRule",
    createFields: [
      { name: "eip", label: "OVN EIP", section: "DNAT", defaultValue: "example-ovn-eip" },
      { name: "externalPort", label: "External Port", section: "DNAT", defaultValue: "8080" },
      { name: "internalIp", label: "Internal IP", section: "DNAT", defaultValue: "10.16.0.10" },
      { name: "internalPort", label: "Internal Port", section: "DNAT", defaultValue: "80" },
      { name: "protocol", label: "Protocol", section: "DNAT", type: "select", defaultValue: "tcp", options: [{ label: "tcp", value: "tcp" }, { label: "udp", value: "udp" }] },
    ],
    buildSpec: (values) => ({ eip: shared.stringValue(values.eip), externalPort: shared.stringValue(values.externalPort), internalIp: shared.stringValue(values.internalIp), internalPort: shared.stringValue(values.internalPort), protocol: shared.stringValue(values.protocol, "tcp") }),
    statusPath: ["status", "ready"],
    extraColumns: [{ label: "EIP", value: (r) => String(shared.getRecord(r.spec).eip || "N/A") }],
  });
